import assert from "node:assert/strict";
import test from "node:test";

import {
  corsResponse,
  flagValue,
  giftCardCode,
  normalizeGiveawayInput,
  normalizeEtsyImport,
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
    headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Dog shampoo", description: "Gentle routine shampoo." }),
  }), {
    ADMIN_API_TOKEN: "admin-token",
    AI: { async run() { return { response: "not valid json" }; } },
  });
  assert.equal(invalidResponse.status, 502);
  assert.deepEqual(await invalidResponse.json(), { ok: false, error: "AI returned an invalid draft. Please try again." });
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
