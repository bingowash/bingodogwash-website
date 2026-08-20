import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  corsResponse,
  flagValue,
  giftCardCode,
  normalizeGiveawayInput,
  normalizeEtsyImport,
  etsyTestHelpers,
  timingSafeEqual,
  timingSafeEqualBytes,
  verifyStripeSignature,
  withSecurityHeaders,
} from "../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js";
import worker from "../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js";
import {
  processCompetitionStripeEvent,
  verifyCompetitionTurnstile
} from "../_functions_NOT_FOR_STATIC_UPLOAD/api/competition.js";
import { nativeShareMode, shareCaption, shareTargets } from "../public/competition-sharing.js";

test("admin hostname root serves the consolidated admin dashboard", async () => {
  let assetPath = "";
  const response = await worker.fetch(new Request("https://admin.bingodogwash.com/"), {
    ASSETS: {
      fetch: async (request) => {
        assetPath = new URL(request.url).pathname;
        return new Response("admin dashboard", { status: 200 });
      },
    },
  });

  assert.equal(response.status, 200);
  assert.equal(assetPath, "/admin/index.html");
});

test("Stripe reporting remains admin-only without changing public payment routes", async () => {
  let queried = false;
  const db = { prepare() { queried = true; throw new Error("unauthorised request must not query payments"); } };
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/stripe"), {
    ADMIN_API_TOKEN: "admin-token",
    GIFT_CARD_DB: db,
  });
  assert.equal(response.status, 401);
  assert.equal(queried, false);
});

test("authenticated Stripe reporting exposes status and aggregates without secrets", async () => {
  const db = {
    prepare(sql) {
      return {
        async first() {
          assert.match(sql, /wash_count/);
          return {
            wash_count: 1, wash_total: 1000,
            gift_card_count: 2, gift_card_total: 3000,
            giveaway_count: 1, giveaway_total: 200,
            competition_count: 1, competition_total: 500,
            last_webhook_at: "2026-08-06T04:00:00.000Z",
          };
        },
        async all() {
          assert.match(sql, /Unified|UNION ALL/i);
          return { results: [{ source: "Dog wash", reference: "BDW-1", customer: "Customer", amount: 1000, currency: "GBP", status: "paid", created_at: "2026-08-06T04:00:00.000Z" }] };
        },
      };
    },
  };
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/stripe", {
    headers: { Authorization: "Bearer admin-token" },
  }), {
    ADMIN_API_TOKEN: "admin-token",
    STRIPE_SECRET_KEY: "sk_live_private",
    STRIPE_WEBHOOK_SECRET: "whsec_private",
    GIFT_CARD_DB: db,
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.totals.count, 5);
  assert.equal(body.totals.amount, 4700);
  assert.equal(body.connection.secretKeyConfigured, true);
  assert.equal(body.connection.webhookSecretConfigured, true);
  assert.equal(JSON.stringify(body).includes("sk_live_private"), false);
  assert.equal(JSON.stringify(body).includes("whsec_private"), false);
});

test("AI drafting remains admin-only and never invokes AI without authorisation", async () => {
  let called = false;
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/ai-drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Dog shampoo", description: "Gentle everyday dog shampoo." }),
  }), {
    ADMIN_API_TOKEN: "admin-token",
    AI: { async run() { called = true; return {}; } },
  });
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test("AI drafting preflight reflects each trusted origin and required headers", async () => {
  for (const origin of ["https://bingodogwash.com", "https://admin.bingodogwash.com"]) {
    const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/ai-drafts", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, content-type, accept",
      },
    }), { ADMIN_API_TOKEN: "admin-token" });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
    assert.match(response.headers.get("Access-Control-Allow-Headers"), /Authorization/);
    assert.match(response.headers.get("Access-Control-Allow-Headers"), /Content-Type/);
    assert.match(response.headers.get("Access-Control-Allow-Headers"), /Accept/);
    assert.match(response.headers.get("Access-Control-Allow-Headers"), /X-Admin-Token/);
  }
});

test("AI drafting rejects an unapproved origin before invoking AI", async () => {
  let called = false;
  const preflight = await worker.fetch(new Request("https://bingodogwash.com/api/admin/ai-drafts", {
    method: "OPTIONS",
    headers: {
      Origin: "https://example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, content-type",
    },
  }), { ADMIN_API_TOKEN: "admin-token" });

  assert.equal(preflight.status, 403);
  assert.equal(preflight.headers.has("Access-Control-Allow-Origin"), false);

  const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/ai-drafts", {
    method: "POST",
    headers: {
      Origin: "https://example.com",
      Authorization: "Bearer admin-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: "Dog shampoo", description: "Gentle everyday dog shampoo." }),
  }), {
    ADMIN_API_TOKEN: "admin-token",
    AI: { async run() { called = true; return {}; } },
  });

  assert.equal(response.status, 403);
  assert.equal(response.headers.has("Access-Control-Allow-Origin"), false);
  assert.equal(called, false);
  assert.equal(JSON.stringify(await response.json()).includes("admin-token"), false);
});

test("protected admin catalogue exposes existing feed products without creating records", async () => {
  const origin = "https://admin.bingodogwash.com";
  const preflight = await worker.fetch(new Request("https://admin.bingodogwash.com/api/admin/catalogue", {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization, content-type" },
  }), { ADMIN_API_TOKEN: "admin-token" });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), origin);
  assert.match(preflight.headers.get("Access-Control-Allow-Methods"), /GET/);

  const unauthorised = await worker.fetch(new Request("https://admin.bingodogwash.com/api/admin/catalogue", { headers: { Origin: origin } }), {
    ADMIN_API_TOKEN: "admin-token",
  });
  assert.equal(unauthorised.status, 401);
  assert.equal(unauthorised.headers.get("Access-Control-Allow-Origin"), origin);

  let databaseWrites = 0;
  const response = await worker.fetch(new Request("https://admin.bingodogwash.com/api/admin/catalogue", {
    headers: { Origin: origin, Authorization: "Bearer admin-token" },
  }), {
    ADMIN_API_TOKEN: "admin-token",
    ETSY_FEATURE_ENABLED: "false",
    GIFT_CARD_DB: { prepare() { databaseWrites += 1; throw new Error("catalogue fallback must not query or mutate D1"); } },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.ok(body.count >= 6);
  assert.equal(databaseWrites, 0);
  const collar = body.products.find((product) => product.name === "Adjustable Blue Dog Collar");
  assert.equal(collar.source, "avasam");
  assert.equal(collar.supplier, "Avasam");
  assert.equal(collar.price, 7.99);
  assert.match(collar.publicUrl, /^https:\/\/bingodogwash\.com\/product\.html\?id=avasam-/);
  assert.equal(collar.publicUrl.includes("undefined"), false);
});

test("admin catalogue rejects untrusted origins without wildcard CORS", async () => {
  const response = await worker.fetch(new Request("https://admin.bingodogwash.com/api/admin/catalogue", {
    headers: { Origin: "https://unapproved.example", Authorization: "Bearer admin-token" },
  }), { ADMIN_API_TOKEN: "admin-token" });
  assert.equal(response.status, 403);
  assert.equal(response.headers.has("Access-Control-Allow-Origin"), false);
});

function marketingStatusDatabase() {
  return {
    prepare(sql) {
      return {
        first: async () => sql.includes("marketing_settings")
          ? { enabled: 0, schedule_hour_utc: 9, schedule_minute_utc: 0, last_run_date: "", next_run_at: "" }
          : sql.includes("marketing_connections")
            ? null
            : { products_promoted: 0, clicks: 0, engagement: 0, sales: 0 },
        all: async () => ({ results: [] }),
      };
    },
  };
}

test("marketing admin CORS covers preflight, success, authentication and server errors", async () => {
  const origin = "https://admin.bingodogwash.com";
  const preflight = await worker.fetch(new Request("https://bingodogwash.com/api/admin/marketing", {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization, content-type" },
  }), {});
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), origin);
  assert.notEqual(preflight.headers.get("Access-Control-Allow-Origin"), "*");
  assert.match(preflight.headers.get("Access-Control-Allow-Methods"), /GET/);
  assert.match(preflight.headers.get("Access-Control-Allow-Headers"), /Authorization/);

  const unauthorised = await worker.fetch(new Request("https://bingodogwash.com/api/admin/marketing", { headers: { Origin: origin } }), {
    ADMIN_API_TOKEN: "admin-token",
    GIFT_CARD_DB: marketingStatusDatabase(),
  });
  assert.equal(unauthorised.status, 401);
  assert.equal(unauthorised.headers.get("Access-Control-Allow-Origin"), origin);

  const successful = await worker.fetch(new Request("https://bingodogwash.com/api/admin/marketing", { headers: { Origin: origin, Authorization: "Bearer admin-token" } }), {
    ADMIN_API_TOKEN: "admin-token",
    GIFT_CARD_DB: marketingStatusDatabase(),
  });
  assert.equal(successful.status, 200);
  assert.equal(successful.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal((await successful.json()).ok, true);

  const failed = await worker.fetch(new Request("https://bingodogwash.com/api/admin/marketing", { headers: { Origin: origin, Authorization: "Bearer admin-token" } }), {
    ADMIN_API_TOKEN: "admin-token",
    GIFT_CARD_DB: { prepare() { throw new Error("database unavailable"); } },
  });
  assert.equal(failed.status, 502);
  assert.equal(failed.headers.get("Access-Control-Allow-Origin"), origin);
  assert.deepEqual(await failed.json(), { ok: false, error: "Marketing status is temporarily unavailable." });
});

test("marketing admin CORS rejects unapproved origins without a wildcard", async () => {
  let queried = false;
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/marketing", {
    headers: { Origin: "https://unapproved.example", Authorization: "Bearer admin-token" },
  }), {
    ADMIN_API_TOKEN: "admin-token",
    GIFT_CARD_DB: { prepare() { queried = true; throw new Error("must not query"); } },
  });
  assert.equal(response.status, 403);
  assert.equal(response.headers.has("Access-Control-Allow-Origin"), false);
  assert.notEqual(response.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(queried, false);
});

test("AI drafting accepts product facts and returns editable non-publishing fields", async () => {
  let requestInput;
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/ai-drafts", {
    method: "POST",
    headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Bingo Gentle Shampoo",
      category: "Dog grooming",
      price: "£12.99",
      description: "A gentle shampoo for routine dog washing.",
      tone: "friendly",
    }),
  }), {
    ADMIN_API_TOKEN: "admin-token",
    MARKETING_AI_MODEL: "test-model",
    AI: {
      async run(model, input) {
        assert.equal(model, "test-model");
        requestInput = input;
        return { response: JSON.stringify({
          productDescription: "A gentle shampoo for routine dog washing.",
          socialCaption: "Make wash day feel simple with Bingo Gentle Shampoo.",
          emailSubject: "A gentle choice for wash day",
          emailPreview: "Discover a straightforward shampoo for routine dog washing.",
        }) };
      },
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.saved, false);
  assert.equal(body.publishable, false);
  assert.equal(body.draft.emailSubject, "A gentle choice for wash day");
  assert.equal(requestInput.messages.some((message) => message.content.includes("customer")), false);
  assert.equal(JSON.stringify(body).includes("admin-token"), false);
  assert.equal(JSON.stringify(body).includes("test-model"), false);
});

test("AI drafting decodes HTML entities as plain editable text", async () => {
  let prompt;
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/ai-drafts", {
    method: "POST",
    headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "3/8&quot; ribbon",
      description: "A black &amp; white lead for dogs.",
    }),
  }), {
    ADMIN_API_TOKEN: "admin-token",
    AI: {
      async run(_model, input) {
        prompt = input.messages.at(-1).content;
        return { response: JSON.stringify({
          productDescription: "A 3/8&quot; black &amp; white ribbon.",
          socialCaption: "Smart &amp; practical.",
          emailSubject: "A 3/8&#34; ribbon",
          emailPreview: "Black &#38; white style.",
        }) };
      },
    },
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(JSON.parse(prompt).product.name, '3/8" ribbon');
  assert.equal(JSON.parse(prompt).product.description, "A black & white lead for dogs.");
  assert.equal(body.draft.productDescription, 'A 3/8" black & white ribbon.');
  assert.equal(body.draft.socialCaption, "Smart & practical.");
  assert.equal(body.draft.emailSubject, 'A 3/8" ribbon');
  assert.equal(body.draft.emailPreview, "Black & white style.");
});

test("AI drafting rejects unsupported methods and invalid model output", async () => {
  const getResponse = await worker.fetch(new Request("https://bingodogwash.com/api/admin/ai-drafts", {
    headers: { Authorization: "Bearer admin-token" },
  }), { ADMIN_API_TOKEN: "admin-token", AI: { async run() { return {}; } } });
  assert.equal(getResponse.status, 405);

  const invalidResponse = await worker.fetch(new Request("https://bingodogwash.com/api/admin/ai-drafts", {
    method: "POST",
    headers: { Origin: "https://admin.bingodogwash.com", Authorization: "Bearer admin-token", "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Dog shampoo", description: "Gentle routine shampoo." }),
  }), {
    ADMIN_API_TOKEN: "admin-token",
    AI: { async run() { return { response: "not valid json" }; } },
  });
  assert.equal(invalidResponse.status, 502);
  assert.equal(invalidResponse.headers.get("Access-Control-Allow-Origin"), "https://admin.bingodogwash.com");
  assert.deepEqual(await invalidResponse.json(), { ok: false, error: "AI returned an invalid draft. Please try again." });
});

test("AI drafting accepts a JSON object wrapped in model commentary", async () => {
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/ai-drafts", {
    method: "POST",
    headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Dog bow", description: "A decorative bow for dogs." }),
  }), {
    ADMIN_API_TOKEN: "admin-token",
    AI: { async run() { return { response: 'Draft follows:\n```json\n{"productDescription":"A decorative bow for dogs.","socialCaption":"A decorative finishing touch for dogs."}\n```' }; } },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).draft.productDescription, "A decorative bow for dogs.");
});

test("AI product distribution requires admin authorisation and explicit confirmation", async () => {
  const unauthorised = await worker.fetch(new Request("https://bingodogwash.com/api/admin/ai-distribution", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmed: true }),
  }), { ADMIN_API_TOKEN: "admin-token" });
  assert.equal(unauthorised.status, 401);

  const unconfirmed = await worker.fetch(new Request("https://bingodogwash.com/api/admin/ai-distribution", {
    method: "POST",
    headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
    body: JSON.stringify({ confirmed: false }),
  }), { ADMIN_API_TOKEN: "admin-token" });
  assert.equal(unconfirmed.status, 400);
  assert.deepEqual(await unconfirmed.json(), { ok: false, error: "Distribution must be reviewed and confirmed." });
});

test("AI generation remains draft-only and distribution is a separate endpoint", async () => {
  let aiCalls = 0;
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/ai-drafts", {
    method: "POST",
    headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Dog ribbon", description: "A decorative ribbon for dogs." }),
  }), {
    ADMIN_API_TOKEN: "admin-token",
    AI: { async run() { aiCalls += 1; return { response: JSON.stringify({ productDescription: "A decorative ribbon for dogs.", socialCaption: "A decorative finishing touch." }) }; } },
    GIFT_CARD_DB: { prepare() { throw new Error("Generation must not access distribution storage."); } },
  });
  assert.equal(response.status, 200);
  assert.equal(aiCalls, 1);
  const body = await response.json();
  assert.equal(body.saved, false);
  assert.equal(body.publishable, false);
});

const topDogCompetitionRow = {
  id: "top-dog-2026",
  slug: "top-dog-2026",
  name: "Top Dog 2026",
  description: "Test competition",
  entry_fee: 500,
  prize_amount: 50000,
  max_photos: 3,
  opens_at: "2000-01-01T00:00:00.000Z",
  closes_at: "2099-12-31T23:59:59.000Z",
  status: "open",
  voting_enabled: 0,
  rules: "Test rules",
  terms: "Test terms",
  winner_entry_id: null
};

function competitionTestDb({ entries = [], photos = [] } = {}) {
  return {
    async batch(statements) {
      return statements.map(() => ({ success: true }));
    },
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes("FROM competitions")) {
                return values[0] === topDogCompetitionRow.slug ? topDogCompetitionRow : null;
              }
              if (sql.includes("COUNT(*) AS total_entries")) {
                return { total_entries: 0, revenue: 0 };
              }
              if (sql.includes("SELECT p.object_key, p.content_type, p.sort_order")) {
                const photo = photos.find((item) => item.id === values[0]);
                return photo ? {
                  object_key: photo.object_key,
                  content_type: photo.content_type,
                  sort_order: photo.sort_order
                } : null;
              }
              if (sql.includes("FROM competition_entries") && sql.includes("public_slug = ?")) {
                return entries.find((entry) => entry.public_slug === values[1] &&
                  (!sql.includes("stripe_checkout_session_id = ?") || entry.stripe_checkout_session_id === values[2])) || null;
              }
              if (sql.includes("FROM competition_entries") && sql.includes("payment_status = 'paid'")) {
                return entries.find((entry) => entry.id === values[0] &&
                  entry.competition_id === values[1] && entry.payment_status === "paid") || null;
              }
              if (sql.includes("FROM competition_photos") && sql.includes("ORDER BY sort_order LIMIT 1")) {
                return photos.find((photo) => photo.entry_id === values[0]) || null;
              }
              return null;
            },
            async all() {
              if (sql.includes("FROM competition_entries WHERE competition_id = ? ORDER BY")) {
                return { results: entries };
              }
              if (sql.includes("FROM competition_photos WHERE entry_id IN")) {
                return { results: photos };
              }
              if (sql.includes("SELECT p.object_key") && sql.includes("WHERE p.entry_id = ?")) {
                return { results: photos.filter((photo) => photo.entry_id === values[0]).map((photo) => ({ object_key: photo.object_key })) };
              }
              return { results: [] };
            },
            async run() {
              return { meta: { changes: 0 } };
            }
          };
        }
      };
    }
  };
}

function competitionTestEnv(overrides = {}, data = {}) {
  return {
    GIFT_CARD_DB: competitionTestDb(data),
    COMPETITION_PHOTOS: { put: async () => {}, delete: async () => {}, get: async () => null, head: async () => null },
    ...overrides
  };
}

function competitionEntryRow(overrides = {}) {
  return {
    id: "entry-1",
    competition_id: "top-dog-2026",
    entry_number: 1,
    public_slug: "bingo-abcd1234",
    owner_name: "Ada Lovelace",
    owner_first_name: "Ada",
    email: "ada@example.com",
    dog_name: "Bingo",
    breed: "Labrador",
    town: "London",
    dog_age: "4 years",
    status: "pending",
    payment_status: "paid",
    amount: 500,
    views: 0,
    shares: 0,
    vote_count: 0,
    featured: 0,
    created_at: "2026-07-30T12:00:00.000Z",
    ...overrides
  };
}

function competitionPhotoRows(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `photo-${index + 1}`,
    entry_id: "entry-1",
    object_key: `top-dog-2026/entry-1/photo-${index + 1}.jpg`,
    content_type: "image/jpeg",
    sort_order: index + 1
  }));
}

function competitionStripeEvent(overrides = {}) {
  return {
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_top_dog_123",
        payment_intent: "pi_top_dog_123",
        payment_status: "paid",
        amount_total: 500,
        currency: "gbp",
        metadata: {
          type: "competition_entry",
          entry_id: "entry-1",
          competition_id: "top-dog-2026",
          dog_name: "Bingo"
        },
        ...overrides
      }
    }
  };
}

function competitionWebhookDb(entryOverrides = {}) {
  const entry = competitionEntryRow({
    status: "awaiting_payment",
    payment_status: "unpaid",
    stripe_checkout_session_id: "cs_top_dog_123",
    stripe_payment_intent_id: null,
    ...entryOverrides
  });
  const state = { entry, updates: 0 };
  return {
    state,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes("JOIN competitions c")) {
                return entry.id === values[0] && entry.competition_id === values[1]
                  ? { ...entry, entry_fee: topDogCompetitionRow.entry_fee }
                  : null;
              }
              if (sql.includes("id <> ?") && sql.includes("stripe_payment_intent_id")) return null;
              if (sql.includes("SELECT email, owner_first_name")) return entry;
              return null;
            },
            async run() {
              if (!sql.includes("UPDATE competition_entries SET payment_status='paid'")) {
                return { meta: { changes: 0 } };
              }
              const [sessionId, paymentIntentId, paidAt, updatedAt, entryId, competitionId, expectedSessionId] = values;
              if (
                entry.id !== entryId ||
                entry.competition_id !== competitionId ||
                entry.payment_status === "paid" ||
                entry.stripe_checkout_session_id !== expectedSessionId
              ) {
                return { meta: { changes: 0 } };
              }
              Object.assign(entry, {
                payment_status: "paid",
                status: "pending",
                stripe_checkout_session_id: sessionId,
                stripe_payment_intent_id: paymentIntentId,
                paid_at: paidAt,
                updated_at: updatedAt
              });
              state.updates += 1;
              return { meta: { changes: 1 } };
            }
          };
        }
      };
    }
  };
}

test("timingSafeEqual handles equal, different, and different-length values", () => {
  assert.equal(timingSafeEqual("abc123", "abc123"), true);
  assert.equal(timingSafeEqual("abc123", "abc124"), false);
  assert.equal(timingSafeEqual("abc123", "abc1234"), false);
});

test("timingSafeEqualBytes compares string secrets without direct equality", async () => {
  assert.equal(await timingSafeEqualBytes("admin-token", "admin-token"), true);
  assert.equal(await timingSafeEqualBytes("admin-token", "admin-tokem"), false);
  assert.equal(await timingSafeEqualBytes("admin-token", "admin-token-extra"), false);
});

test("verifyStripeSignature validates a signed payload", async () => {
  const secret = "whsec_test_secret";
  const payload = JSON.stringify({ id: "evt_test", type: "checkout.session.completed" });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const signature = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

  assert.equal(await verifyStripeSignature(payload, `t=${timestamp},v1=wrong,v1=${signature}`, secret), true);
  assert.equal(await verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, "wrong_secret"), false);
});

test("verifyStripeSignature rejects stale timestamps", async () => {
  const secret = "whsec_test_secret";
  const payload = JSON.stringify({ id: "evt_old", type: "checkout.session.completed" });
  const timestamp = "1000";
  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const signature = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

  assert.equal(await verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret, 300, 2000), false);
});

test("withSecurityHeaders adds production browser security headers", async () => {
  const request = new Request("https://bingodogwash.com/health");
  const response = withSecurityHeaders(corsResponse(request, { ok: true }), request);

  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("X-Frame-Options"), "SAMEORIGIN");
  assert.equal(response.headers.get("Strict-Transport-Security"), "max-age=31536000; includeSubDomains; preload");
  assert.match(response.headers.get("Content-Security-Policy"), /default-src 'self'/);
  assert.match(response.headers.get("Content-Security-Policy"), /script-src 'self' https:\/\/challenges\.cloudflare\.com/);
  assert.match(response.headers.get("Content-Security-Policy"), /img-src 'self' https: data: blob:/);
});

test("Top Dog Turnstile verification fails closed without token or secret", async () => {
  const request = new Request("https://bingodogwash.com/api/competitions/top-dog-2026/entries", { method: "POST" });
  assert.equal((await verifyCompetitionTurnstile("", request, { TURNSTILE_SECRET: "test-secret" })).success, false);
  assert.equal((await verifyCompetitionTurnstile("test-token", request, {})).success, false);
});

test("Top Dog Turnstile verification requires successful matching action and hostname", async () => {
  const originalFetch = globalThis.fetch;
  let verificationRequest;
  globalThis.fetch = async (url, options) => {
    verificationRequest = { url, options };
    return Response.json({
      success: true,
      hostname: "bingodogwash.com",
      action: "turnstile-spin-v1"
    });
  };
  try {
    const request = new Request("https://bingodogwash.com/api/competitions/top-dog-2026/entries", {
      method: "POST",
      headers: { "CF-Connecting-IP": "203.0.113.5" }
    });
    const result = await verifyCompetitionTurnstile("test-token", request, { TURNSTILE_SECRET: "test-secret" });
    assert.equal(result.success, true);
    assert.equal(verificationRequest.url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal(verificationRequest.options.method, "POST");
    assert.equal(verificationRequest.options.body.get("response"), "test-token");
    assert.equal(verificationRequest.options.body.get("remoteip"), "203.0.113.5");

    globalThis.fetch = async () => Response.json({
      success: true,
      hostname: "evil.example",
      action: "turnstile-spin-v1"
    });
    assert.equal((await verifyCompetitionTurnstile("test-token", request, { TURNSTILE_SECRET: "test-secret" })).success, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const shareEntry = {
  slug: "bingo-abcd1234",
  dogName: "Bingo",
  breed: "Labrador",
  town: "London",
  profileUrl: "https://bingodogwash.com/top-dog.html?dog=bingo-abcd1234"
};

test("Top Dog Facebook sharing uses the official URL share dialog", () => {
  const target = new URL(shareTargets(shareEntry).facebook);
  assert.equal(target.origin, "https://www.facebook.com");
  assert.equal(target.pathname, "/sharer/sharer.php");
  assert.equal(target.searchParams.get("u"), shareEntry.profileUrl);
});

test("Top Dog WhatsApp sharing prefills dog details, hashtags and profile URL", () => {
  const message = new URL(shareTargets(shareEntry).whatsapp).searchParams.get("text");
  assert.match(message, /Bingo/);
  assert.match(message, /Labrador/);
  assert.match(message, /London/);
  assert.match(message, /TopDogCompetition/);
  assert.match(message, /top-dog\.html/);
});

test("Top Dog X sharing prefills short text, hashtags and profile URL", () => {
  const target = new URL(shareTargets(shareEntry).x);
  assert.equal(target.origin, "https://x.com");
  assert.equal(target.pathname, "/intent/post");
  assert.match(target.searchParams.get("text"), /#TopDog2026/);
  assert.match(target.searchParams.get("text"), /top-dog\.html/);
});

test("Top Dog Instagram sharing provides its destination and reusable caption", () => {
  assert.equal(shareTargets(shareEntry).instagram, "https://www.instagram.com/");
  const caption = shareCaption(shareEntry);
  assert.match(caption, /Bingo/);
  assert.match(caption, /Labrador/);
  assert.match(caption, /London/);
  assert.match(caption, /#BingoDogWash/);
});

test("Top Dog native sharing selects file, link and fallback modes", () => {
  const file = new Blob(["image"], { type: "image/png" });
  assert.equal(nativeShareMode({ share() {}, canShare: () => true }, file), "file");
  assert.equal(nativeShareMode({ share() {}, canShare: () => false }, file), "link");
  assert.equal(nativeShareMode({}, file), "unavailable");
});

test("Top Dog share endpoint accepts each platform and records only a click", async () => {
  const entry = competitionEntryRow({ status: "approved" });
  for (const platform of ["facebook", "whatsapp", "x", "instagram", "native"]) {
    const response = await worker.fetch(
      new Request(`https://bingodogwash.com/api/competitions/top-dog-2026/dogs/${entry.public_slug}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform })
      }),
      competitionTestEnv({}, { entries: [entry] })
    );
    assert.equal(response.status, 202, platform);
    assert.deepEqual(await response.json(), { ok: true, tracked: "click" });
  }
});

test("Top Dog entrant photo requires the matching paid Stripe session", async () => {
  const entry = competitionEntryRow({ stripe_checkout_session_id: "cs_paid_123" });
  const photo = competitionPhotoRows(1)[0];
  const env = competitionTestEnv({
    COMPETITION_PHOTOS: {
      get: async (key) => key === photo.object_key ? { body: new Uint8Array([1, 2, 3]), size: 3 } : null
    }
  }, { entries: [entry], photos: [photo] });
  const denied = await worker.fetch(
    new Request(`https://bingodogwash.com/api/competitions/top-dog-2026/entries/${entry.public_slug}/share-photo?session_id=cs_wrong`),
    env
  );
  assert.equal(denied.status, 404);
  const allowed = await worker.fetch(
    new Request(`https://bingodogwash.com/api/competitions/top-dog-2026/entries/${entry.public_slug}/share-photo?session_id=cs_paid_123`),
    env
  );
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("Cache-Control"), "private, no-store");
});

test("Top Dog dashboard production route reaches the competition handler", async () => {
  const response = await worker.fetch(
    new Request("https://bingodogwash.com/api/competitions/top-dog-2026/dashboard"),
    competitionTestEnv()
  );
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.competition.slug, "top-dog-2026");
  assert.equal(data.stats.totalEntries, 0);
});

test("Top Dog gallery production route reaches the competition handler", async () => {
  const response = await worker.fetch(
    new Request("https://bingodogwash.com/api/competitions/top-dog-2026/gallery"),
    competitionTestEnv()
  );
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.deepEqual(data.entries, []);
});

test("Top Dog leaderboard production route reaches the competition handler", async () => {
  const response = await worker.fetch(
    new Request("https://bingodogwash.com/api/competitions/top-dog-2026/leaderboard"),
    competitionTestEnv()
  );
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.votingEnabled, false);
  assert.deepEqual(data.entries, []);
});

test("Top Dog leaderboard admin-host route reaches the existing public handler", async () => {
  const response = await worker.fetch(
    new Request("https://admin.bingodogwash.com/api/competitions/top-dog-2026/leaderboard"),
    competitionTestEnv()
  );
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.votingEnabled, false);
  assert.deepEqual(data.entries, []);
});

test("Top Dog entry and checkout POST production route preserves Turnstile gating", async () => {
  const form = new FormData();
  form.set("ownerName", "Ada Lovelace");
  form.set("email", "ada@example.com");
  form.set("dogName", "Bingo");
  form.set("breed", "Labrador");
  form.set("town", "London");
  form.set("rulesAccepted", "true");
  const response = await worker.fetch(
    new Request("https://bingodogwash.com/api/competitions/top-dog-2026/entries", {
      method: "POST",
      body: form
    }),
    competitionTestEnv({ TURNSTILE_SECRET: "test-secret" })
  );
  const data = await response.json();
  assert.equal(response.status, 403);
  assert.equal(data.error, "Please complete the security check and try again.");
});

test("unknown competition routes still return 404", async () => {
  const unknownCompetition = await worker.fetch(
    new Request("https://bingodogwash.com/api/competitions/not-a-competition/dashboard"),
    competitionTestEnv()
  );
  assert.equal(unknownCompetition.status, 404);
  assert.equal((await unknownCompetition.json()).error, "Competition not found.");

  const unknownAction = await worker.fetch(
    new Request("https://bingodogwash.com/api/competitions/top-dog-2026/not-a-route"),
    competitionTestEnv()
  );
  assert.equal(unknownAction.status, 404);
  assert.equal((await unknownAction.json()).error, "Competition endpoint not found.");
});

test("Top Dog admin unlock accepts a valid admin token", async () => {
  const token = "test-admin-token";
  const response = await worker.fetch(
    new Request("https://admin.bingodogwash.com/api/admin/competitions/top-dog-2026/auth", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}"
    }),
    competitionTestEnv({ ADMIN_API_TOKEN: token })
  );
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.authenticated, true);
  assert.equal(data.competition.slug, "top-dog-2026");
});

test("Top Dog admin unlock rejects an invalid admin token", async () => {
  const response = await worker.fetch(
    new Request("https://admin.bingodogwash.com/api/admin/competitions/top-dog-2026/auth", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-admin-token", "Content-Type": "application/json" },
      body: "{}"
    }),
    competitionTestEnv({ ADMIN_API_TOKEN: "correct-admin-token" })
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "Admin authorisation required.");
});

test("Top Dog admin unlock rejects a missing admin token", async () => {
  const response = await worker.fetch(
    new Request("https://admin.bingodogwash.com/api/admin/competitions/top-dog-2026/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }),
    competitionTestEnv({ ADMIN_API_TOKEN: "correct-admin-token" })
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "Admin authorisation required.");
});

test("unknown Top Dog admin route returns 404 for an authenticated admin", async () => {
  const token = "test-admin-token";
  const response = await worker.fetch(
    new Request("https://admin.bingodogwash.com/api/admin/competitions/top-dog-2026/not-a-route", {
      headers: { Authorization: `Bearer ${token}` }
    }),
    competitionTestEnv({ ADMIN_API_TOKEN: token })
  );
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Unsupported admin operation.");
});

test("Top Dog admin entry includes one authenticated photo", async () => {
  const token = "test-admin-token";
  const response = await worker.fetch(
    new Request("https://admin.bingodogwash.com/api/admin/competitions/top-dog-2026/entries", {
      headers: { Authorization: `Bearer ${token}` }
    }),
    competitionTestEnv(
      { ADMIN_API_TOKEN: token },
      { entries: [competitionEntryRow()], photos: competitionPhotoRows(1) }
    )
  );
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.entries[0].photos.length, 1);
  assert.equal(data.entries[0].photos[0].url, "/api/admin/competitions/top-dog-2026/photos/photo-1");
});

test("Top Dog admin entry includes up to three ordered authenticated photos", async () => {
  const token = "test-admin-token";
  const response = await worker.fetch(
    new Request("https://admin.bingodogwash.com/api/admin/competitions/top-dog-2026/entries", {
      headers: { Authorization: `Bearer ${token}` }
    }),
    competitionTestEnv(
      { ADMIN_API_TOKEN: token },
      { entries: [competitionEntryRow()], photos: competitionPhotoRows(3) }
    )
  );
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.entries[0].photos.length, 3);
  assert.deepEqual(data.entries[0].photos.map((photo) => photo.sortOrder), [1, 2, 3]);
});

test("Top Dog authenticated photo endpoint returns 404 for a missing R2 object", async () => {
  const token = "test-admin-token";
  const response = await worker.fetch(
    new Request("https://admin.bingodogwash.com/api/admin/competitions/top-dog-2026/photos/photo-1", {
      headers: { Authorization: `Bearer ${token}` }
    }),
    competitionTestEnv(
      { ADMIN_API_TOKEN: token },
      { entries: [competitionEntryRow()], photos: competitionPhotoRows(1) }
    )
  );
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error, "Competition photo is missing from storage.");
});

test("Top Dog admin photo endpoint rejects an unauthenticated request", async () => {
  const response = await worker.fetch(
    new Request("https://admin.bingodogwash.com/api/admin/competitions/top-dog-2026/photos/photo-1"),
    competitionTestEnv(
      { ADMIN_API_TOKEN: "test-admin-token" },
      { entries: [competitionEntryRow()], photos: competitionPhotoRows(1) }
    )
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "Admin authorisation required.");
});

test("Top Dog approval is blocked when no reviewable R2 image exists", async () => {
  const token = "test-admin-token";
  const response = await worker.fetch(
    new Request("https://admin.bingodogwash.com/api/admin/competitions/top-dog-2026/entries/entry-1", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" })
    }),
    competitionTestEnv(
      { ADMIN_API_TOKEN: token },
      { entries: [competitionEntryRow()], photos: competitionPhotoRows(1) }
    )
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "Approval requires at least one reviewable uploaded photo.");
});

test("Top Dog approval is blocked for an unpaid entry even when its photo is reviewable", async () => {
  const token = "test-admin-token";
  let photoChecked = false;
  const response = await worker.fetch(
    new Request("https://admin.bingodogwash.com/api/admin/competitions/top-dog-2026/entries/entry-1", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" })
    }),
    competitionTestEnv(
      {
        ADMIN_API_TOKEN: token,
        COMPETITION_PHOTOS: {
          head: async () => {
            photoChecked = true;
            return { size: 10 };
          }
        }
      },
      {
        entries: [competitionEntryRow({ payment_status: "unpaid", status: "awaiting_payment" })],
        photos: competitionPhotoRows(1)
      }
    )
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "Approval requires a confirmed paid entry.");
  assert.equal(photoChecked, false);
});

test("Top Dog Stripe processing rejects an unpaid Checkout Session", async () => {
  const db = competitionWebhookDb();
  const processed = await processCompetitionStripeEvent(
    competitionStripeEvent({ payment_status: "unpaid" }),
    { GIFT_CARD_DB: db }
  );
  assert.equal(processed, false);
  assert.equal(db.state.updates, 0);
  assert.equal(db.state.entry.payment_status, "unpaid");
});

test("Top Dog Stripe processing accepts a duplicate only when payment identifiers match", async () => {
  const db = competitionWebhookDb({
    payment_status: "paid",
    status: "pending",
    stripe_payment_intent_id: "pi_top_dog_123"
  });
  const processed = await processCompetitionStripeEvent(competitionStripeEvent(), { GIFT_CARD_DB: db });
  assert.equal(processed, true);
  assert.equal(db.state.updates, 0);

  const mismatched = await processCompetitionStripeEvent(
    competitionStripeEvent({ payment_intent: "pi_different" }),
    { GIFT_CARD_DB: db }
  );
  assert.equal(mismatched, false);
  assert.equal(db.state.updates, 0);
});

test("Top Dog Stripe processing rejects an incorrect payment amount", async () => {
  const db = competitionWebhookDb();
  const processed = await processCompetitionStripeEvent(
    competitionStripeEvent({ amount_total: 499 }),
    { GIFT_CARD_DB: db }
  );
  assert.equal(processed, false);
  assert.equal(db.state.updates, 0);
  assert.equal(db.state.entry.payment_status, "unpaid");
});

test("Top Dog Stripe processing records a valid payment once", async () => {
  const db = competitionWebhookDb();
  const processed = await processCompetitionStripeEvent(competitionStripeEvent(), { GIFT_CARD_DB: db });
  assert.equal(processed, true);
  assert.equal(db.state.updates, 1);
  assert.equal(db.state.entry.payment_status, "paid");
  assert.equal(db.state.entry.status, "pending");
  assert.equal(db.state.entry.stripe_payment_intent_id, "pi_top_dog_123");
});

test("withSecurityHeaders applies default cache policy to asset responses", async () => {
  const request = new Request("https://bingodogwash.com/assets/logo.png");
  const response = withSecurityHeaders(new Response("image-bytes"), request);

  assert.equal(response.headers.get("Cache-Control"), "public, max-age=31536000, immutable");
});

test("Etsy feature flag parser is explicit", () => {
  assert.equal(flagValue("true"), true);
  assert.equal(flagValue("1"), true);
  assert.equal(flagValue("false"), false);
  assert.equal(flagValue(""), false);
  assert.equal(flagValue(undefined), false);
});

test("public Etsy products stay empty when feature flag is disabled", async () => {
  const response = await worker.fetch(
    new Request("https://bingodogwash.com/api/etsy/products"),
    { ETSY_FEATURE_ENABLED: "false" }
  );
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.enabled, false);
  assert.deepEqual(data.products, []);
});

test("public Etsy products exclude every non-public state and live marketplace results", async () => {
  const originalFetch = globalThis.fetch;
  let selectSql = "";
  const records = [
    { external_listing_id: "12345", title: "Approved dog tag", admin_status: "published", public_visibility: 1, affiliate_storefront: "Concordia Mercatura", affiliate_url: "https://tracking.example/approved", affiliate_verified_url: "https://tracking.example/approved", affiliate_final_url: "https://www.etsy.com/listing/12345/item", affiliate_destination_listing_id: "12345", affiliate_review_status: "approved", affiliate_reviewed_at: "2026-08-20T10:00:00.000Z", affiliate_reviewed_by: "reviewer", affiliate_verification_status: "match", affiliate_verified_at: "2026-08-20T09:00:00.000Z", affiliate_provider: "rakuten", affiliate_program: "etsy_creator_collective_uk" },
    { external_listing_id: "arbitrary-public", title: "Arbitrary marketplace result", admin_status: "published", public_visibility: 1 },
    { external_listing_id: "review-1", title: "Review product", admin_status: "review", public_visibility: 0 },
    { external_listing_id: "hidden-1", title: "Hidden product", admin_status: "hidden", public_visibility: 0 },
    { external_listing_id: "unpublished-1", title: "Unpublished product", admin_status: "unpublished", public_visibility: 0 },
    { external_listing_id: "archived-1", title: "Archived product", admin_status: "archived", public_visibility: 0 },
    { external_listing_id: "approved-private", title: "Approved but private", admin_status: "approved", public_visibility: 0 }
  ].map((record) => ({ ...record, description: "Reviewed listing", category: "Accessories", price: 1299, currency: "GBP", listing_url: `https://www.etsy.com/uk/listing/${record.external_listing_id}`, primary_image: "", personalisation_available: 0 }));
  globalThis.fetch = async () => { throw new Error("the public Etsy feed must not call the live marketplace API"); };
  const db = {
    prepare(sql) {
      selectSql = sql;
      return {
        bind() { return this; },
        async all() {
          return { results: records.filter((record) => record.admin_status === "published" && record.public_visibility === 1) };
        }
      };
    }
  };
  try {
    const response = await worker.fetch(new Request("https://bingodogwash.com/api/etsy/products"), {
      ETSY_FEATURE_ENABLED: "true", GIFT_CARD_DB: db
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.match(selectSql, /admin_status = 'published'/);
    assert.match(selectSql, /public_visibility = 1/);
    assert.equal(data.products.length, 1);
    assert.equal(data.products[0].sourceProductId, "12345");
    assert.equal(data.products[0].externalUrl, "https://tracking.example/approved");
    assert.equal(data.products[0].originalListingUrl, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("new Etsy sync inserts default to review and private", () => {
  const source = readFileSync(new URL("../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js", import.meta.url), "utf8");
  const insert = source.slice(source.indexOf("INSERT INTO etsy_products"), source.indexOf("function normalizeEtsyImport"));
  assert.match(insert, /'review', 0/);
  assert.doesNotMatch(insert, /'published', 1/);
});

test("scheduled Etsy sync stays off when persisted automatic sync is disabled", async () => {
  const pending = [];
  let syncRunWrites = 0;
  const db = {
    prepare(sql) {
      if (/INSERT INTO etsy_sync_runs/.test(sql)) syncRunWrites += 1;
      return {
        bind() { return this; },
        async first() {
          if (/etsy_connections/.test(sql)) return { status: "Connected", automatic_sync_enabled: 0, access_token: "stored-token" };
          return null;
        },
        async all() { return { results: [] }; },
        async run() { return { success: true }; }
      };
    }
  };
  await worker.scheduled({ cron: "7 7 * * *", scheduledTime: Date.now() }, {
    GIFT_CARD_DB: db,
    ETSY_FEATURE_ENABLED: "true",
    ETSY_SYNC_ENABLED: "true",
    MARKETING_PUBLISHING_DISABLED: "true",
    AI_PROSPECTING_ENABLED: "false"
  }, { waitUntil(promise) { pending.push(Promise.resolve(promise)); } });
  await Promise.all(pending);
  assert.equal(syncRunWrites, 0);
});

test("scheduled Etsy sync gate requires flags, persisted opt-in, connection and valid token", async () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const connectionDb = (overrides = {}) => ({
    prepare() {
      return { async first() { return { status: "Connected", automatic_sync_enabled: 1, access_token: "stored-token", token_expires_at: future, ...overrides }; } };
    }
  });
  assert.equal(await etsyTestHelpers.scheduledSyncAllowed({ GIFT_CARD_DB: connectionDb() }), true);
  assert.equal(await etsyTestHelpers.scheduledSyncAllowed({ GIFT_CARD_DB: connectionDb({ automatic_sync_enabled: 0 }) }), false);
  assert.equal(await etsyTestHelpers.scheduledSyncAllowed({ GIFT_CARD_DB: connectionDb({ status: "Disconnected" }) }), false);
  assert.equal(await etsyTestHelpers.scheduledSyncAllowed({ GIFT_CARD_DB: connectionDb({ access_token: "", refresh_token: "" }) }), false);

  const workerSource = readFileSync(new URL("../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js", import.meta.url), "utf8");
  const scheduled = workerSource.slice(workerSource.indexOf("async scheduled("), workerSource.indexOf("async function handleRequestWithAssets"));
  assert.match(scheduled, /ETSY_FEATURE_ENABLED/);
  assert.match(scheduled, /ETSY_SYNC_ENABLED/);
  assert.match(scheduled, /scheduledEtsySyncAllowed/);
});

test("Etsy admin status reports the persisted automatic-sync value", async () => {
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          if (/etsy_connections/.test(sql)) return { status: "Connected", automatic_sync_enabled: 1, access_token: "stored-token" };
          if (/COUNT\(\*\)/.test(sql)) return { count: 0 };
          return null;
        },
        async all() { return { results: [] }; }
      };
    }
  };
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy", {
    headers: { Authorization: "Bearer admin-token" }
  }), { ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: db, ETSY_FEATURE_ENABLED: "true", ETSY_SYNC_ENABLED: "true" });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.connection.automaticSyncEnabled, true);
});

test("AI Product Centre keeps Etsy draft-only and outside publishable channels", () => {
  const source = readFileSync(new URL("../public/admin/ai-drafts.js", import.meta.url), "utf8");
  assert.match(source, /\["etsy", "Etsy", "draft"\]/);
  assert.match(source, /const publishable=channels\.filter\(\(channel\)=>channel==="facebook"\|\|channel==="instagram"\)/);
  assert.doesNotMatch(source, /publishable[^;]*etsy/);
  assert.doesNotMatch(source, /api\.etsy\.com|listings\/active|listings\/batch|listings\/create|listings\/update|listings\/publish/);
});

test("Creator Collective migration adds only additive affiliate fields with draft default", () => {
  const migration = readFileSync(new URL("../migrations/0022_etsy_creator_collective_affiliate.sql", import.meta.url), "utf8");
  for (const field of ["original_listing_url", "affiliate_url", "affiliate_provider", "affiliate_program", "affiliate_storefront", "affiliate_provenance", "commission_disclosure", "affiliate_review_status", "affiliate_reviewed_at", "affiliate_reviewed_by"]) {
    assert.match(migration, new RegExp(`ADD COLUMN ${field}\\b`));
  }
  assert.match(migration, /affiliate_review_status TEXT NOT NULL DEFAULT 'draft'/);
  assert.doesNotMatch(migration, /DROP|DELETE|UPDATE etsy_products/i);
});

test("affiliate verification migration adds review evidence fields safely", () => {
  const migration = readFileSync(new URL("../migrations/0023_etsy_affiliate_verification.sql", import.meta.url), "utf8");
  for (const field of ["affiliate_verification_status", "affiliate_verified_url", "affiliate_final_url", "affiliate_destination_listing_id", "affiliate_verified_at"]) assert.match(migration, new RegExp(`ADD COLUMN ${field}\\b`));
  assert.match(migration, /affiliate_verification_status TEXT NOT NULL DEFAULT 'unverified'/);
  assert.doesNotMatch(migration, /DROP|DELETE|UPDATE etsy_products/i);
});

test("Etsy sync preserves affiliate metadata and original listing provenance", () => {
  const source = readFileSync(new URL("../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js", import.meta.url), "utf8");
  const upsert = source.slice(source.indexOf("async function upsertEtsyListing"), source.indexOf("function normalizeEtsyImport"));
  const update = upsert.slice(upsert.indexOf("UPDATE etsy_products"), upsert.indexOf("return \"updated\""));
  assert.match(update, /original_listing_url = \?/);
  assert.match(upsert, /etsyListingIdFromUrl\(storedOriginalUrl\) === product\.externalListingId/);
  assert.doesNotMatch(update, /affiliate_url\s*=/);
  assert.doesNotMatch(update, /affiliate_review_status\s*=/);
  assert.match(upsert, /'review', 0, 'draft'/);
});

test("exact Etsy listing references accept only IDs and HTTPS Etsy listing URLs", () => {
  for (const value of ["4530046541", "etsy-4530046541", "https://www.etsy.com/uk/listing/4530046541/example", "https://etsy.com/listing/4530046541/example"]) {
    assert.equal(etsyTestHelpers.etsyListingReference(value).listingId, "4530046541");
  }
  for (const value of ["http://www.etsy.com/listing/4530046541/example", "https://example.com/listing/4530046541/example", "https://www.etsy.com/search?q=dog", "https://www.etsy.com/shop/example", "etsy-invalid"]) {
    assert.equal(etsyTestHelpers.etsyListingReference(value).listingId, "");
  }
});

test("Etsy admin routes allow only approved admin CORS origins", async () => {
  const approved = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/import-listing", { method: "OPTIONS", headers: { Origin: "https://admin.bingodogwash.com", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type" } }), {});
  assert.equal(approved.status, 204);
  assert.equal(approved.headers.get("Access-Control-Allow-Origin"), "https://admin.bingodogwash.com");
  assert.match(approved.headers.get("Access-Control-Allow-Headers") || "", /Authorization/i);
  const rejected = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/affiliate-verify", { method: "OPTIONS", headers: { Origin: "https://attacker.example", "Access-Control-Request-Method": "POST" } }), {});
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get("Access-Control-Allow-Origin"), null);
});

test("Product Centre exposes an explicit validated Etsy import action on the main API origin", () => {
  const html = readFileSync(new URL("../public/admin/ai-drafts.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("../public/admin/ai-drafts.js", import.meta.url), "utf8");
  assert.match(html, /data-etsy-import[^>]*hidden disabled[^>]*>Import Etsy listing/);
  assert.match(script, /const etsyApiOrigin = location\.hostname === "admin\.bingodogwash\.com" \? "https:\/\/bingodogwash\.com"/);
  assert.match(script, /function importCurrentEtsyListing\(\)/);
  assert.match(script, /data-etsy-import.*addEventListener\("click",importCurrentEtsyListing\)/);
  assert.match(script, /event\.key==="Enter"[\s\S]*importCurrentEtsyListing\(\)/);
  assert.match(script, /if\(state\.etsyImportPromise\)return state\.etsyImportPromise/);
});

test("exact Etsy listing import uses the Etsy JSON API without scraping HTML", async () => {
  const requests = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (input, options = {}) => {
    requests.push({ url: String(input), options });
    return Response.json({ listing_id: 4530046541, shop_id: 99, title: "Wooden dog tag", description: "Personalised tag", price: { amount: 1299, divisor: 100, currency_code: "GBP" }, state: "active", url: "https://www.etsy.com/uk/listing/4530046541/wooden-dog-tag", images: [] });
  };
  try {
    const listing = await etsyTestHelpers.fetchExactEtsyListing("4530046541", { ETSY_API_KEY: "test-key" });
    assert.equal(listing.listing_id, 4530046541);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://api.etsy.com/v3/application/listings/4530046541?includes=Images,Shop");
    assert.equal(requests[0].options.method, undefined);
    assert.equal(requests[0].options.body, undefined);
  } finally { globalThis.fetch = oldFetch; }
});

test("exact Etsy import remains review/private and preserves affiliate columns", () => {
  const source = readFileSync(new URL("../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js", import.meta.url), "utf8");
  const upsert = source.slice(source.indexOf("async function upsertEtsyListing"), source.indexOf("function normalizeEtsyImport"));
  assert.match(upsert, /WHERE source = 'etsy' AND external_listing_id = \?/);
  assert.match(upsert, /'review', 0, 'draft'/);
  for (const column of ["affiliate_url", "affiliate_provider", "affiliate_program", "affiliate_storefront", "affiliate_review_status", "affiliate_reviewed_at", "affiliate_reviewed_by", "commission_disclosure"]) {
    assert.doesNotMatch(upsert.match(/UPDATE etsy_products SET[\s\S]*?return "updated"/)?.[0] || "", new RegExp(`${column}\\s*=`));
  }
  const exactImport = source.slice(source.indexOf("async function adminEtsyImportListing"), source.indexOf("async function etsyAffiliateProduct"));
  assert.doesNotMatch(exactImport, /admin_status\s*=\s*'published'|public_visibility\s*=\s*1|method:\s*"(?:POST|PUT|PATCH|DELETE)"/i);
});

test("affiliate URL policy accepts HTTPS tracking URLs and rejects unsafe schemes", () => {
  assert.equal(etsyTestHelpers.cleanAffiliateUrl("https://click.example.net/track?id=approved"), "https://click.example.net/track?id=approved");
  for (const unsafe of ["javascript:alert(1)", "data:text/html,test", "http://example.net/track", "ftp://example.net/file"]) {
    assert.equal(etsyTestHelpers.cleanAffiliateUrl(unsafe), "");
  }
});

test("outbound Etsy URL uses only a valid approved affiliate URL and retains provenance", () => {
  const base = { external_listing_id: "123", title: "Dog tag", listing_url: "https://www.etsy.com/uk/listing/123/dog-tag", original_listing_url: "https://www.etsy.com/uk/listing/123/dog-tag", affiliate_url: "https://click.example.net/track?id=approved", affiliate_provider: "rakuten", affiliate_storefront: "Concordia Mercatura" };
  for (const status of ["draft", "rejected", "review", ""]) {
    const shaped = etsyTestHelpers.publicProductShape({ ...base, affiliate_review_status: status });
    assert.equal(shaped.externalUrl, base.original_listing_url);
    assert.equal(shaped.originalListingUrl, base.original_listing_url);
    assert.equal(shaped.commissionDisclosure, "");
  }
  const approved = etsyTestHelpers.publicProductShape({ ...base, affiliate_review_status: "approved" });
  assert.equal(approved.externalUrl, base.affiliate_url);
  assert.equal(approved.originalListingUrl, base.original_listing_url);
  assert.equal(approved.affiliateProvider, "rakuten");
  assert.match(approved.commissionDisclosure, /may earn a commission/i);
  const malformed = etsyTestHelpers.publicProductShape({ ...base, affiliate_review_status: "approved", affiliate_url: "javascript:alert(1)" });
  assert.equal(malformed.externalUrl, base.original_listing_url);
});

test("affiliate approval is authenticated, records reviewer, and does not publish product", async () => {
  let queriedWithoutAuth = false;
  const unauthorised = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/affiliate-approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "etsy-123" }) }), {
    ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: { prepare() { queriedWithoutAuth = true; throw new Error("must not query"); } }
  });
  assert.equal(unauthorised.status, 401);
  assert.equal(queriedWithoutAuth, false);

  let approvalSql = "";
  let approvalBinds = [];
  const product = { id: "db-123", external_listing_id: "123", source: "etsy", listing_url: "https://www.etsy.com/uk/listing/123/dog-tag", original_listing_url: "https://www.etsy.com/uk/listing/123/dog-tag", affiliate_url: "https://click.example.net/track?id=approved", affiliate_provider: "rakuten", affiliate_program: "etsy_creator_collective_uk", affiliate_storefront: "Concordia Mercatura", affiliate_review_status: "draft", affiliate_verification_status: "match", affiliate_verified_url: "https://click.example.net/track?id=approved", affiliate_destination_listing_id: "123", admin_status: "review", public_visibility: 0 };
  const db = { prepare(sql) { const statement = { bind(...values) { if (/affiliate_review_status = 'approved'/.test(sql)) { approvalSql = sql; approvalBinds = values; } return statement; }, async first() { return /SELECT \* FROM etsy_products/.test(sql) ? product : null; }, async run() { return { success: true }; }, async all() { return { results: [] }; } }; return statement; } };
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/affiliate-approve", { method: "POST", headers: { Authorization: "Bearer admin-token", "X-Admin-Actor": "human-reviewer", "Content-Type": "application/json" }, body: JSON.stringify({ id: "etsy-123" }) }), { ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: db });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.affiliateReviewStatus, "approved");
  assert.equal(data.affiliateReviewedBy, "human-reviewer");
  assert.equal(data.adminStatus, "review");
  assert.equal(data.publicVisibility, false);
  assert.match(approvalSql, /affiliate_reviewed_at = \?/);
  assert.equal(approvalBinds[1], "human-reviewer");
  assert.doesNotMatch(approvalSql, /admin_status|public_visibility/);
});

test("affiliate approval uses Etsy listing identity while preserving persisted MATCH evidence", async () => {
  const base = {
    id: "db-4530046541", source: "etsy", external_listing_id: "4530046541",
    listing_url: "https://www.etsy.com/listing/4530046541/canonical-slug",
    original_listing_url: "https://www.etsy.com/uk/listing/4530046541/original-slug?ref=creator_collective",
    affiliate_url: "https://etsy.me/current-link", affiliate_verified_url: "https://etsy.me/current-link",
    affiliate_provider: "rakuten", affiliate_program: "etsy_creator_collective_uk", affiliate_storefront: "Concordia Mercatura",
    affiliate_review_status: "draft", affiliate_verification_status: "match", affiliate_destination_listing_id: "4530046541",
    affiliate_verified_at: "2026-08-13T18:51:49.657Z", admin_status: "review", public_visibility: 0
  };
  const attempt = async (overrides = {}, authenticated = true) => {
    const product = { ...base, ...overrides };
    let approvalSql = "";
    const db = { prepare(sql) { const statement = { bind() { return statement; }, async first() { return /SELECT \* FROM etsy_products/.test(sql) ? product : null; }, async run() { if (/affiliate_review_status = 'approved'/.test(sql)) approvalSql = sql; return { success: true }; }, async all() { return { results: [] }; } }; return statement; } };
    const headers = { "Content-Type": "application/json", ...(authenticated ? { Authorization: "Bearer admin-token", "X-Admin-Actor": "human-reviewer" } : {}) };
    const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/affiliate-approve", { method: "POST", headers, body: JSON.stringify({ id: product.id }) }), { ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: db });
    return { response, approvalSql };
  };

  for (const original_listing_url of [
    "https://www.etsy.com/uk/listing/4530046541/different-slug",
    "https://www.etsy.com/listing/4530046541/another-slug?ref=creator_collective&campaign=reviewed"
  ]) {
    const { response, approvalSql } = await attempt({ original_listing_url });
    assert.equal(response.status, 200, original_listing_url);
    assert.match(approvalSql, /affiliate_review_status = 'approved'/);
    assert.doesNotMatch(approvalSql, /admin_status|public_visibility/);
    const result = await response.json();
    assert.equal(result.adminStatus, "review");
    assert.equal(result.publicVisibility, false);
  }

  for (const overrides of [
    { original_listing_url: "https://www.etsy.com/listing/9999999999/different-product" },
    { original_listing_url: null },
    { original_listing_url: "http://www.etsy.com/listing/4530046541/insecure" },
    { original_listing_url: "https://example.com/listing/4530046541/not-etsy" },
    { affiliate_url: "https://etsy.me/changed-after-verification" },
    { affiliate_verification_status: "unverified" },
    { affiliate_verification_status: null },
    { affiliate_destination_listing_id: "9999999999" }
  ]) {
    const { response, approvalSql } = await attempt(overrides);
    assert.equal(response.status, 409, JSON.stringify(overrides));
    assert.equal(approvalSql, "");
  }

  const unauthorised = await attempt({}, false);
  assert.equal(unauthorised.response.status, 401);
  assert.equal(unauthorised.approvalSql, "");
});

test("affiliate draft stores a separate HTTPS URL as draft and rejection clears only that URL", async () => {
  const product = { id: "db-456", external_listing_id: "456", source: "etsy", listing_url: "https://www.etsy.com/uk/listing/456/dog-bow", admin_status: "review", public_visibility: 0, affiliate_review_status: "draft" };
  const updates = [];
  const db = { prepare(sql) { const statement = { bind(...values) { if (/UPDATE etsy_products SET/.test(sql)) updates.push({ sql, values }); return statement; }, async first() { return /SELECT \* FROM etsy_products/.test(sql) ? product : null; }, async run() { return { success: true }; }, async all() { return { results: [] }; } }; return statement; } };
  const headers = { Authorization: "Bearer admin-token", "X-Admin-Actor": "reviewer", "Content-Type": "application/json" };
  const draftResponse = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/affiliate-draft", { method: "POST", headers, body: JSON.stringify({ id: "etsy-456", originalListingUrl: product.listing_url, affiliateUrl: "https://tracking.example.org/click?campaign=reviewed", affiliateProvider: "rakuten", affiliateProgram: "etsy_creator_collective_uk", affiliateStorefront: "Concordia Mercatura", affiliateProvenance: "Human-supplied Rakuten reference", commissionDisclosure: "" }) }), { ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: db });
  const draft = await draftResponse.json();
  assert.equal(draftResponse.status, 200);
  assert.equal(draft.affiliateReviewStatus, "draft");
  const draftUpdate = updates.find((entry) => /affiliate_url = \?/.test(entry.sql));
  assert.equal(draftUpdate.values[0], product.listing_url);
  assert.equal(draftUpdate.values[1], "https://tracking.example.org/click?campaign=reviewed");
  assert.match(draftUpdate.sql, /affiliate_reviewed_at = NULL/);
  assert.doesNotMatch(draftUpdate.sql, /(?:^|[^_])listing_url = \?/);

  const rejectResponse = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/affiliate-reject", { method: "POST", headers, body: JSON.stringify({ id: "etsy-456" }) }), { ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: db });
  const rejected = await rejectResponse.json();
  assert.equal(rejectResponse.status, 200);
  assert.equal(rejected.affiliateReviewStatus, "rejected");
  const rejectUpdate = updates.find((entry) => /affiliate_url = NULL/.test(entry.sql));
  assert.ok(rejectUpdate);
  assert.doesNotMatch(rejectUpdate.sql, /(?:^|[^_])listing_url\s*=/);
});

test("affiliate draft validates Etsy listing identity instead of serialized URL equality", async () => {
  const headers = { Authorization: "Bearer admin-token", "Content-Type": "application/json" };
  const baseProduct = { id: "db-4530046541", external_listing_id: "4530046541", source: "etsy", listing_url: "https://www.etsy.com/listing/4530046541/canonical-api-slug", admin_status: "review", public_visibility: 0, affiliate_review_status: "draft" };
  const requestFor = (originalListingUrl, product = baseProduct) => {
    const db = { prepare(sql) { const statement = { bind() { return statement; }, async first() { return /SELECT \* FROM etsy_products/.test(sql) ? product : null; }, async run() { return { success: true }; }, async all() { return { results: [] }; } }; return statement; } };
    return worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/affiliate-draft", { method: "POST", headers, body: JSON.stringify({ id: product.id, originalListingUrl, affiliateUrl: "https://tracking.example/affiliate", affiliateProvider: "rakuten", affiliateProgram: "etsy_creator_collective_uk", affiliateStorefront: "Concordia Mercatura" }) }), { ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: db });
  };

  for (const accepted of [
    "https://www.etsy.com/uk/listing/4530046541/different-slug?ref=search&ga_order=most_relevant",
    "https://etsy.com/listing/4530046541/another-valid-slug",
    "https://www.etsy.com/listing/4530046541/"
  ]) assert.equal((await requestFor(accepted)).status, 200, accepted);

  for (const rejected of [
    "https://www.etsy.com/listing/9999999999/different-product",
    "https://example.com/listing/4530046541/item",
    "http://www.etsy.com/listing/4530046541/item",
    "https://www.etsy.com/search?q=4530046541",
    "https://www.etsy.com/listing/not-a-number/item"
  ]) assert.equal((await requestFor(rejected)).status, 400, rejected);

  assert.equal((await requestFor("https://www.etsy.com/listing/4530046541/item", { ...baseProduct, external_listing_id: "1111111111" })).status, 400);
  assert.equal((await requestFor("https://www.etsy.com/listing/4530046541/item", { ...baseProduct, listing_url: "https://www.etsy.com/listing/2222222222/other" })).status, 400);
});

test("Product Centre exposes manual Etsy affiliate review controls without publishing", () => {
  const html = readFileSync(new URL("../public/admin/ai-drafts.html", import.meta.url), "utf8");
  const script = readFileSync(new URL("../public/admin/ai-drafts.js", import.meta.url), "utf8");
  assert.match(html, /Save affiliate draft/);
  assert.match(html, /Approve affiliate link/);
  assert.match(html, /Reject\/remove affiliate link/);
  assert.match(html, /affiliate-draft/);
  assert.match(html, /affiliate-approve/);
  assert.match(html, /affiliate-reject/);
  assert.match(script, /etsyAffiliateAction/);
  assert.doesNotMatch(script, /api\.etsy\.com|\/v3\/application\/listings/);
});

test("affiliate redirect verification matches only the selected Etsy listing without credentials", async () => {
  const oldFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    requests.push({ url, options });
    if (url.startsWith("https://cloudflare-dns.com/")) return Response.json({ Answer: [{ type: 1, data: "104.18.1.1" }] });
    if (url === "https://tracking.example/start") return new Response(null, { status: 302, headers: { Location: "https://www.etsy.com/uk/listing/12345/dog-tag" } });
    return new Response("ok", { status: 200 });
  };
  try {
    const finalUrl = await etsyTestHelpers.resolveAffiliateDestination("https://tracking.example/start");
    assert.equal(finalUrl, "https://www.etsy.com/uk/listing/12345/dog-tag");
    assert.equal(etsyTestHelpers.etsyListingIdFromUrl(finalUrl), "12345");
    for (const request of requests) {
      assert.equal(request.options.redirect, "manual");
      assert.equal(request.options.headers?.Authorization, undefined);
      assert.equal(request.options.headers?.Cookie, undefined);
      assert.equal(request.options.credentials, undefined);
    }
  } finally { globalThis.fetch = oldFetch; }
});

test("affiliate redirect verification resolves relative locations and validates every hop", async () => {
  const oldFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.startsWith("https://cloudflare-dns.com/")) return Response.json({ Answer: [{ type: 1, data: "104.18.1.1" }] });
    requested.push({ url, redirect: options.redirect });
    if (url === "https://tracking.example/start") return new Response(null, { status: 302, headers: { Location: "/next" } });
    if (url === "https://tracking.example/next") return new Response(null, { status: 307, headers: { Location: "https://www.etsy.com/uk/listing/4530046541/item" } });
    return new Response("ok", { status: 200 });
  };
  try {
    const finalUrl = await etsyTestHelpers.resolveAffiliateDestination("https://tracking.example/start");
    assert.equal(finalUrl, "https://www.etsy.com/uk/listing/4530046541/item");
    assert.deepEqual(etsyTestHelpers.affiliateProductMatch("4530046541", finalUrl), { status: "match", destinationListingId: "4530046541" });
    assert.deepEqual(requested.map((entry) => entry.url), ["https://tracking.example/start", "https://tracking.example/next", "https://www.etsy.com/uk/listing/4530046541/item"]);
    assert.ok(requested.every((entry) => entry.redirect === "manual"));
  } finally { globalThis.fetch = oldFetch; }
});

test("affiliate redirect verification fails closed for invalid redirect responses", async () => {
  const oldFetch = globalThis.fetch;
  const run = async (responseFactory) => {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.startsWith("https://cloudflare-dns.com/")) return Response.json({ Answer: [{ type: 1, data: new URL(url).searchParams.get("name") === "127.0.0.1" ? "127.0.0.1" : "104.18.1.1" }] });
      return responseFactory();
    };
    return etsyTestHelpers.resolveAffiliateDestination("https://tracking.example/start");
  };
  try {
    await assert.rejects(() => run(() => new Response(null, { status: 302 })), /missing a destination/);
    await assert.rejects(() => run(() => new Response(null, { status: 302, headers: { Location: "http://www.etsy.com/listing/4530046541/item" } })), /unsafe/);
    await assert.rejects(() => run(() => new Response(null, { status: 302, headers: { Location: "https://127.0.0.1/listing/4530046541/item" } })), /blocked address/);
    await assert.rejects(() => run(() => new Response(null, { status: 302, headers: { Location: "https://[invalid" } })), /malformed/);
    await assert.rejects(() => run(() => new Response(null, { status: 300, headers: { Location: "https://www.etsy.com/listing/4530046541/item" } })), /unsupported redirect/);
    await assert.rejects(() => run(() => { throw new Error("network unavailable"); }), /network unavailable/);
  } finally { globalThis.fetch = oldFetch; }
});

test("affiliate verification identifies mismatch and non-Etsy destinations", () => {
  assert.deepEqual(etsyTestHelpers.affiliateProductMatch("12345", "https://www.etsy.com/listing/12345/item"), { status: "match", destinationListingId: "12345" });
  assert.deepEqual(etsyTestHelpers.affiliateProductMatch("12345", "https://www.etsy.com/listing/99999/other"), { status: "mismatch", destinationListingId: "99999" });
  assert.deepEqual(etsyTestHelpers.affiliateProductMatch("12345", "https://example.com/listing/12345"), { status: "unverified", destinationListingId: "" });
  assert.deepEqual(etsyTestHelpers.affiliateProductMatch("12345", "https://notetsy.com/listing/12345"), { status: "unverified", destinationListingId: "" });
});

test("affiliate verification blocks private addresses and excessive redirects", async () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "::1", "fc00::1", "fe80::1"]) assert.equal(etsyTestHelpers.publicVerificationIp(ip), false);
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.startsWith("https://cloudflare-dns.com/")) return Response.json({ Answer: [{ type: 1, data: "104.18.1.1" }] });
    const number = Number(new URL(url).pathname.slice(1) || 0);
    return new Response(null, { status: 302, headers: { Location: `https://tracking.example/${number + 1}` } });
  };
  try { await assert.rejects(() => etsyTestHelpers.resolveAffiliateDestination("https://tracking.example/0", 2), /redirect limit/); }
  finally { globalThis.fetch = oldFetch; }
});

test("affiliate approval requires a persisted MATCH for the unchanged URL", async () => {
  const product = { id: "db-no-match", external_listing_id: "123", source: "etsy", listing_url: "https://www.etsy.com/listing/123/item", original_listing_url: "https://www.etsy.com/listing/123/item", affiliate_url: "https://tracking.example/item", affiliate_provider: "rakuten", affiliate_program: "etsy_creator_collective_uk", affiliate_storefront: "Concordia Mercatura", affiliate_review_status: "draft", affiliate_verification_status: "mismatch", affiliate_verified_url: "https://tracking.example/item", affiliate_destination_listing_id: "999" };
  let wrote = false;
  const db = { prepare() { return { bind() { return this; }, async first() { return product; }, async run() { wrote = true; } }; } };
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/affiliate-approve", { method: "POST", headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" }, body: JSON.stringify({ id: product.id }) }), { ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: db });
  assert.equal(response.status, 409);
  assert.equal(wrote, false);
});

test("Etsy publication eligibility fails closed for every invalid verification state", () => {
  const verified = {
    external_listing_id: "12345", listing_url: "https://www.etsy.com/listing/12345/item", original_listing_url: "https://www.etsy.com/listing/12345/item",
    affiliate_url: "https://tracking.example/12345", affiliate_verified_url: "https://tracking.example/12345", affiliate_final_url: "https://www.etsy.com/listing/12345/item",
    affiliate_destination_listing_id: "12345", affiliate_verification_status: "match", affiliate_verified_at: "2026-08-20T09:00:00.000Z",
    affiliate_review_status: "approved", affiliate_reviewed_at: "2026-08-20T10:00:00.000Z", affiliate_reviewed_by: "reviewer",
    affiliate_provider: "rakuten", affiliate_program: "etsy_creator_collective_uk", affiliate_storefront: "Concordia Mercatura"
  };
  assert.deepEqual(etsyTestHelpers.etsyAffiliateEligibility(verified), { eligible: true, status: "match", reason: "VERIFIED MATCH", affiliateUrl: verified.affiliate_url });
  for (const [overrides, reason] of [
    [{ affiliate_url: "" }, "MISSING AFFILIATE URL"],
    [{ affiliate_verified_url: "", affiliate_verified_at: "", affiliate_verification_status: "unverified" }, "UNVERIFIED"],
    [{ affiliate_url: "https://tracking.example/changed" }, "CHANGED AFTER VERIFICATION"],
    [{ affiliate_verification_status: "mismatch" }, "MISMATCH"],
    [{ affiliate_verification_status: "failed" }, "FAILED"],
    [{ affiliate_destination_listing_id: "99999" }, "MISMATCH: destination listing ID does not match"],
    [{ affiliate_final_url: "https://example.com/listing/12345" }, "FAILED: final destination is not Etsy"],
    [{ affiliate_review_status: "draft" }, "UNVERIFIED: affiliate review approval is required"]
  ]) assert.equal(etsyTestHelpers.etsyAffiliateEligibility({ ...verified, ...overrides }).reason, reason);
});

test("admin Etsy publish blocks invalid products without changing their records", async () => {
  const product = { id: "db-123", source: "etsy", external_listing_id: "123", listing_url: "https://www.etsy.com/listing/123/item", original_listing_url: "https://www.etsy.com/listing/123/item", affiliate_review_status: "approved", affiliate_verification_status: "mismatch" };
  let published = false;
  const db = { prepare(sql) { const statement = { bind() { return statement; }, async all() { return { results: [product] }; }, async first() { return null; }, async run() { if (/admin_status = \?/.test(sql)) published = true; return { success: true }; } }; return statement; } };
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/publish", { method: "POST", headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" }, body: JSON.stringify({ ids: [product.id] }) }), { ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: db });
  const data = await response.json();
  assert.equal(response.status, 409);
  assert.match(data.error, /MISSING AFFILIATE URL/);
  assert.equal(published, false);
});

test("Etsy import normalization keeps external content safe", () => {
  const product = normalizeEtsyImport({
    listing_id: 12345,
    shop_id: 678,
    title: "<Custom Dog Tag>",
    description: "<script>alert(1)</script> Personalised gift",
    price: { amount: 1299, divisor: 100, currency_code: "GBP" },
    quantity: 4,
    state: "active",
    url: "https://www.etsy.com/uk/listing/12345/custom-dog-tag",
    images: [
      { url_fullxfull: "https://i.etsystatic.com/123/example.jpg" },
      { url_fullxfull: "https://evil.example/image.jpg" }
    ],
    tags: ["dog", "personalised"],
    taxonomy_path: ["Pet gifts"],
    is_personalizable: true,
    created_timestamp: 1760000000,
    updated_timestamp: 1760000100
  }, "678");

  assert.equal(product.externalListingId, "12345");
  assert.equal(product.title, "Custom Dog Tag");
  assert.match(product.description, /scriptalert/);
  assert.equal(product.price, 1299);
  assert.equal(product.currency, "GBP");
  assert.equal(product.primaryImage, "https://i.etsystatic.com/123/example.jpg");
  assert.equal(JSON.parse(product.additionalImages).length, 0);
  assert.equal(product.personalisationAvailable, 1);
});

test("gift card codes are cryptographically generated in the expected unique format", () => {
  const codes = new Set(Array.from({ length: 500 }, () => giftCardCode()));
  assert.equal(codes.size, 500);
  for (const code of codes) {
    assert.match(code, /^BDW-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  }
});

test("giveaway input normalization sanitizes fields and requires explicit terms", () => {
  const input = normalizeGiveawayInput({
    firstName: " <Ada> ",
    lastName: " Lovelace<script> ",
    email: "ADA@example.com",
    phone: " +44 7700 900123 ",
    termsAccepted: true,
    submissionId: "123e4567-e89b-12d3-a456-426614174000",
  });
  assert.equal(input.firstName, "Ada");
  assert.equal(input.lastName, "Lovelacescript");
  assert.equal(input.email, "ada@example.com");
  assert.equal(input.termsAccepted, true);
  assert.match(input.submissionId, /^[a-zA-Z0-9-]+$/);
});

test("giveaway checkout rejects cross-site submissions before Stripe", async () => {
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/giveaway/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" },
    body: JSON.stringify({}),
  }), { GIFT_CARD_DB: {}, STRIPE_SECRET_KEY: "sk_test_not_used" });
  assert.equal(response.status, 403);
});

test("giveaway checkout creates an exact £2 idempotent Stripe session", async () => {
  const originalFetch = globalThis.fetch;
  let stripeRequest;
  globalThis.fetch = async (url, options) => {
    stripeRequest = { url, options, body: new URLSearchParams(options.body) };
    return new Response(JSON.stringify({ id: "cs_test_giveaway", url: "https://checkout.stripe.com/test" }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const response = await worker.fetch(new Request("https://bingodogwash.com/api/giveaway/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://bingodogwash.com", "Sec-Fetch-Site": "same-origin" },
      body: JSON.stringify({ firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", phone: "", termsAccepted: true, submissionId: "123e4567-e89b-12d3-a456-426614174000" }),
    }), { GIFT_CARD_DB: {}, STRIPE_SECRET_KEY: "sk_test_giveaway" });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.paymentUrl, "https://checkout.stripe.com/test");
    assert.equal(stripeRequest.url, "https://api.stripe.com/v1/checkout/sessions");
    assert.equal(stripeRequest.body.get("line_items[0][price_data][unit_amount]"), "200");
    assert.equal(stripeRequest.body.get("metadata[type]"), "giveaway");
    assert.equal(stripeRequest.options.headers["Idempotency-Key"], "giveaway-123e4567-e89b-12d3-a456-426614174000");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
