import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleMarketingRequest, isMarketingPath, marketingTestHelpers, runMarketingAutomation, runMarketingSchedule } from "../_functions_NOT_FOR_STATIC_UPLOAD/api/marketing.js";
import marketingStagingWorker from "../_functions_NOT_FOR_STATIC_UPLOAD/api/marketing-staging.js";

test("temporary controlled Instagram UI and endpoint are removed while the guard migration remains", () => {
  const html = readFileSync(new URL("../public/admin/marketing.html", import.meta.url), "utf8");
  const frontend = readFileSync(new URL("../public/admin/marketing.js", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../_functions_NOT_FOR_STATIC_UPLOAD/api/marketing.js", import.meta.url), "utf8");
  const guardMigration = readFileSync(new URL("../migrations/0011_marketing_one_time_guards.sql", import.meta.url), "utf8");

  assert.doesNotMatch(html, /Run Controlled Instagram Test|instagram-controlled-test/);
  assert.doesNotMatch(frontend, /controlledInstagramTest|instagram-controlled-test/);
  assert.doesNotMatch(worker, /controlledInstagramTest|instagram-controlled-test/);
  assert.match(guardMigration, /CREATE TABLE IF NOT EXISTS marketing_one_time_guards/);
});

test("marketing routes remain isolated under their own API prefixes", () => {
  assert.equal(isMarketingPath("/api/admin/marketing"), true);
  assert.equal(isMarketingPath("/api/admin/marketing/test"), true);
  assert.equal(isMarketingPath("/api/marketing/track"), true);
  assert.equal(isMarketingPath("/api/checkout"), false);
  assert.equal(isMarketingPath("/api/admin/gift-cards"), false);
});

test("campaign links record a click before preserving product destination and UTM tags", () => {
  const url = marketingTestHelpers.campaignUrl("https://example.com/dog-shampoo?size=large", "campaign-123");
  const tracker = new URL(url);
  assert.equal(tracker.origin, "https://bingodogwash.com");
  assert.equal(tracker.pathname, "/api/marketing/track");
  assert.equal(tracker.searchParams.get("campaign"), "campaign-123");
  const destination = new URL(marketingTestHelpers.trackedDestination(url));
  assert.equal(destination.origin, "https://example.com");
  assert.equal(destination.searchParams.get("size"), "large");
  assert.equal(destination.searchParams.get("utm_source"), "social");
  assert.equal(destination.searchParams.get("utm_campaign"), "campaign-123");
});

test("next marketing run advances to tomorrow after today's posting time", () => {
  assert.equal(
    marketingTestHelpers.nextRunAt({ schedule_hour_utc: 9, schedule_minute_utc: 15 }, new Date("2026-07-31T10:00:00Z")),
    "2026-08-01T09:15:00.000Z"
  );
});

test("marketing admin API rejects requests without the existing admin token", async () => {
  const response = await handleMarketingRequest(new Request("https://bingodogwash.com/api/admin/marketing"), { ADMIN_API_TOKEN: "secret", GIFT_CARD_DB: {} });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "Admin authorisation required.");
});

test("marketing admin API rejects an invalid admin token", async () => {
  const response = await handleMarketingRequest(
    new Request("https://bingodogwash.com/api/admin/marketing", { headers: { Authorization: "Bearer wrong-token" } }),
    { ADMIN_API_TOKEN: "correct-token", GIFT_CARD_DB: {} }
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, "Admin authorisation required.");
});

test("marketing admin API permits authenticated read-only status", async () => {
  const database = {
    prepare(sql) {
      return {
        first: async () => sql.includes("marketing_settings")
          ? { enabled: 0, schedule_hour_utc: 9, schedule_minute_utc: 0, last_run_date: "", next_run_at: "" }
          : { products_promoted: 0, clicks: 0, engagement: 0, sales: 0 },
        all: async () => ({
          results: sql.includes("FROM marketing_posts ORDER")
            ? [{ id: "post-1", error_message: "Invalid OAuth access token - Cannot parse access token" }]
            : []
        })
      };
    }
  };
  const response = await handleMarketingRequest(
    new Request("https://bingodogwash.com/api/admin/marketing", { headers: { Authorization: "Bearer test-token" } }),
    { ADMIN_API_TOKEN: "test-token", GIFT_CARD_DB: database }
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.settings.enabled, false);
  assert.deepEqual(body.history, [{
    id: "post-1",
    error_message: "Meta connection has expired or is invalid. Reconnect Meta in server settings.",
  }]);
});

test("paused marketing schedule does no product or platform work", async () => {
  const db = {
    prepare(sql) {
      assert.match(sql, /marketing_settings/);
      return { first: async () => ({ enabled: 0, schedule_hour_utc: 9, schedule_minute_utc: 0 }) };
    }
  };
  const result = await runMarketingSchedule({ scheduledTime: Date.parse("2026-07-31T09:00:00Z") }, { GIFT_CARD_DB: db });
  assert.deepEqual(result, { ok: true, skipped: "paused" });
});

test("paused automation blocks even an authenticated test-post execution", async () => {
  let queries = 0;
  const db = {
    prepare(sql) {
      queries += 1;
      assert.match(sql, /marketing_settings/);
      return { first: async () => ({ enabled: 0, schedule_hour_utc: 9, schedule_minute_utc: 0 }) };
    }
  };
  const result = await runMarketingAutomation({ GIFT_CARD_DB: db }, { trigger: "test" });
  assert.deepEqual(result, { ok: true, status: "paused", skipped: "paused" });
  assert.equal(queries, 1);
});

test("Meta token validation trims a valid Page access token without adding a prefix", () => {
  const value = `  ${"A".repeat(50)}  `;
  assert.deepEqual(marketingTestHelpers.metaAccessToken(value), { ok: true, token: "A".repeat(50) });
});

test("Meta token validation accepts tokens with a Bearer prefix", () => {
  const value = `Bearer ${"A".repeat(50)}`;
  assert.deepEqual(marketingTestHelpers.metaAccessToken(value), { ok: true, token: "A".repeat(50) });
});

test("Meta token validation reports missing and malformed values safely", () => {
  assert.deepEqual(marketingTestHelpers.metaAccessToken("   "), { ok: false, error: "Meta access token is not configured." });
  for (const value of ["short", `${"A".repeat(25)}\n${"A".repeat(25)}`]) {
    assert.deepEqual(marketingTestHelpers.metaAccessToken(value), { ok: false, error: "Meta connection has expired or is invalid. Reconnect Meta in server settings." });
  }
  assert.deepEqual(marketingTestHelpers.metaAccessToken(`"${"A".repeat(50)}"`), { ok: true, token: "A".repeat(50) });
  assert.deepEqual(marketingTestHelpers.metaAccessToken(`'${"A".repeat(50)}'`), { ok: true, token: "A".repeat(50) });
});

test("Meta OAuth rejection is reported safely and is not retried", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return new Response(JSON.stringify({ error: { code: 190, type: "OAuthException", message: "provider detail" } }), { status: 400 });
  };
  const db = { prepare: () => ({ bind: () => ({ run: async () => ({ success: true }) }) }) };
  try {
    const result = await marketingTestHelpers.publishWithRetry(
      { META_PAGE_ID: "page-id" }, db, "post-id", "facebook",
      { image: "https://example.com/dog.jpg" }, "caption", "https://example.com/product", "A".repeat(50)
    );
    assert.deepEqual(result, { ok: false, error: "Meta connection has expired or is invalid. Reconnect Meta in server settings.", attempts: 1 });
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Instagram preflight reports missing and malformed tokens without a request", async () => {
  assert.deepEqual(await marketingTestHelpers.instagramPreflight({}), { ok: false, error: "Meta access token is not configured.", api: "Instagram Login" });
  assert.deepEqual(await marketingTestHelpers.instagramPreflight({ INSTAGRAM_ACCESS_TOKEN: "short" }), { ok: false, error: "Meta connection has expired or is invalid. Reconnect Meta in server settings.", api: "Instagram Login" });
});

test("Instagram preflight reports an expired or invalid token safely", async () => {
  const originalFetch = globalThis.fetch; let requests = 0;
  globalThis.fetch = async () => { requests += 1; return new Response(JSON.stringify({ error: { code: 190, type: "OAuthException", message: "secret provider detail" } }), { status: 400 }); };
  try {
    const result = await marketingTestHelpers.instagramPreflight({ INSTAGRAM_ACCESS_TOKEN: "A".repeat(50), META_INSTAGRAM_USER_ID: "27879594505014566", META_INSTAGRAM_USERNAME: "bingo_dogwash" });
    assert.deepEqual(result, { ok: false, authenticationOk: false, error: "Meta connection has expired or is invalid. Reconnect Meta in server settings.", api: "Instagram Login", failedCheck: "profile-authentication" });
    assert.equal(requests, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("Instagram preflight separates valid profile authentication from an unavailable permission check", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes("/me/permissions")
    ? new Response(JSON.stringify({ error: { message: "provider detail" } }), { status: 400 })
    : Response.json({ id: "27879594505014566", username: "bingo_dogwash", account_type: "MEDIA_CREATOR" });
  try {
    const result = await marketingTestHelpers.instagramPreflight({ INSTAGRAM_ACCESS_TOKEN: "A".repeat(50), META_INSTAGRAM_USER_ID: "27879594505014566", META_INSTAGRAM_USERNAME: "bingo_dogwash" });
    assert.equal(result.ok, false);
    assert.equal(result.authenticationOk, true);
    assert.equal(result.identityOk, true);
    assert.equal(result.failedCheck, "publishing-permission");
    assert.equal(result.username, "bingo_dogwash");
    assert.equal(result.publishingPermission, "unconfirmed");
    assert.equal(result.error, "Instagram identity verified, but publishing permission cannot be confirmed without a controlled test post.");
  } finally { globalThis.fetch = originalFetch; }
});

test("Instagram preflight treats an empty permission list as unconfirmed, not denied", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes("/me/permissions")
    ? Response.json({ data: [] })
    : Response.json({ id: "expected-id", username: "expected-user", account_type: "BUSINESS" });
  try {
    const result = await marketingTestHelpers.instagramPreflight({ INSTAGRAM_ACCESS_TOKEN: "A".repeat(50), META_INSTAGRAM_USER_ID: "expected-id", META_INSTAGRAM_USERNAME: "expected-user" });
    assert.equal(result.ok, false);
    assert.equal(result.identityOk, true);
    assert.equal(result.publishingPermission, "unconfirmed");
    assert.equal(result.error, "Instagram identity verified, but publishing permission cannot be confirmed without a controlled test post.");
  } finally { globalThis.fetch = originalFetch; }
});

test("Instagram preflight validates the configured Login API user and publishing permission", async () => {
  const originalFetch = globalThis.fetch; const urls = [];
  globalThis.fetch = async (url, options) => {
    urls.push(String(url)); assert.match(options.headers.Authorization, /^Bearer A+$/);
    if (String(url).includes("/me/permissions")) return Response.json({ data: [{ permission: "instagram_content_publish", status: "granted" }] });
    return Response.json({ id: "27879594505014566", username: "bingo_dogwash", account_type: "MEDIA_CREATOR" });
  };
  try {
    const result = await marketingTestHelpers.instagramPreflight({ INSTAGRAM_ACCESS_TOKEN: "A".repeat(50), META_INSTAGRAM_USER_ID: "27879594505014566", META_INSTAGRAM_USERNAME: "bingo_dogwash" });
    assert.equal(result.ok, true); assert.equal(result.username, "bingo_dogwash"); assert.equal(result.accountType, "MEDIA_CREATOR"); assert.equal(result.publishingPermission, "granted");
    assert.equal(urls.some((url) => url.startsWith("https://graph.instagram.com/v26.0/me")), true);
    assert.equal(urls.some((url) => url.startsWith("https://graph.facebook.com/v25.0/me/permissions")), true);
  } finally { globalThis.fetch = originalFetch; }
});

test("Meta preflight distinguishes identity, permission, and network failures safely", async () => {
  const originalFetch = globalThis.fetch;
  const env = { INSTAGRAM_ACCESS_TOKEN: "A".repeat(50), META_INSTAGRAM_USER_ID: "expected-id", META_INSTAGRAM_USERNAME: "expected-user" };
  try {
    globalThis.fetch = async () => Response.json({ id: "different-id", username: "expected-user", account_type: "BUSINESS" });
    assert.equal((await marketingTestHelpers.instagramPreflight(env)).error, "Meta account connection is incomplete.");

    globalThis.fetch = async () => Response.json({ id: "expected-id", username: "expected-user", account_type: "PERSONAL" });
    assert.equal((await marketingTestHelpers.instagramPreflight(env)).identityOk, false);

    globalThis.fetch = async (url) => String(url).includes("/me/permissions")
      ? Response.json({ data: [{ permission: "instagram_content_publish", status: "declined" }] })
      : Response.json({ id: "expected-id", username: "expected-user", account_type: "BUSINESS" });
    assert.equal((await marketingTestHelpers.instagramPreflight(env)).error, "Meta connection does not have permission to publish.");

    globalThis.fetch = async () => { throw new TypeError("provider detail"); };
    assert.equal((await marketingTestHelpers.instagramPreflight(env)).error, "Meta service is temporarily unavailable.");
  } finally { globalThis.fetch = originalFetch; }
});

test("Facebook preflight validates the configured Page ID on Facebook Graph only", async () => {
  const originalFetch = globalThis.fetch; const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return String(url).includes("/debug_token")
      ? Response.json({ data: { is_valid: true, app_id: "12345", application: "BingoApp", type: "PAGE", expires_at: 2800000000, scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"] } })
      : Response.json({ id: "1264938680034651", name: "Bingo Dog Wash" });
  };
  try {
    const result = await marketingTestHelpers.facebookPreflight({ META_PAGE_ACCESS_TOKEN: "B".repeat(50), META_PAGE_ID: "1264938680034651" });
    assert.equal(result.ok, true);
    assert.equal(result.id, "1264938680034651");
    assert.deepEqual(result.permissions, ["pages_manage_posts", "pages_read_engagement", "pages_show_list"]);
    assert.equal(result.tokenStatus.valid, true);
    assert.equal(result.tokenStatus.type, "PAGE");
    assert.equal(result.pageId, "1264938680034651");
    assert.equal(urls.some((url) => url.includes("/debug_token")), true);
    assert.equal(urls.some((url) => url.includes("/1264938680034651")), true);
  } finally { globalThis.fetch = originalFetch; }
});

test("Facebook preflight reports expired token and reconnect instructions", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: { is_valid: false, app_id: "12345", application: "BingoApp", type: "PAGE", expires_at: 0, scopes: ["pages_manage_posts"] } });
  try {
    const result = await marketingTestHelpers.facebookPreflight({ META_PAGE_ACCESS_TOKEN: "B".repeat(50), META_PAGE_ID: "1264938680034651" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "Facebook connection expired. Reconnect Meta account.");
    assert.equal(result.tokenStatus.valid, false);
    assert.equal(result.pageId, "1264938680034651");
  } finally { globalThis.fetch = originalFetch; }
});

test("Facebook preflight reports missing page permissions clearly", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/debug_token")) {
      return Response.json({ data: { is_valid: true, app_id: "12345", application: "BingoApp", type: "PAGE", expires_at: 2800000000, scopes: ["pages_show_list"] } });
    }
    return Response.json({ id: "1264938680034651", name: "Bingo Dog Wash" });
  };
  try {
    const result = await marketingTestHelpers.facebookPreflight({ META_PAGE_ACCESS_TOKEN: "B".repeat(50), META_PAGE_ID: "1264938680034651" });
    assert.equal(result.ok, false);
    assert.equal(result.error, "Facebook connection does not have required page permissions.");
    assert.deepEqual(result.permissions, ["pages_show_list"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("successful Facebook publish uses Bearer auth and returns post ID", async () => {
  const originalFetch = globalThis.fetch;
  let requestedHeaders = null;
  globalThis.fetch = async (_url, options) => {
    requestedHeaders = options.headers;
    return Response.json({ id: "fb-photo-123" });
  };
  try {
    const result = await marketingTestHelpers.publishFacebook({ META_PAGE_ID: "1264938680034651" }, "https://example.com/image.jpg", "caption", "https://example.com/product", "B".repeat(50));
    assert.equal(result, "fb-photo-123");
    assert.equal(requestedHeaders.Authorization, `Bearer ${"B".repeat(50)}`);
  } finally { globalThis.fetch = originalFetch; }
});

test("Facebook page configuration preserves the legacy ID and supports multiple de-duplicated IDs", () => {
  assert.deepEqual(marketingTestHelpers.configuredFacebookPageIds({ META_PAGE_ID: "1264938680034651" }), ["1264938680034651"]);
  assert.deepEqual(marketingTestHelpers.configuredFacebookPageIds({
    META_PAGE_ID: "1264938680034651",
    META_PAGE_IDS: "1264938680034651,61592339597666, 61590905394658",
  }), ["1264938680034651", "61592339597666", "61590905394658"]);
});

test("Facebook multi-page publishing continues after a page fails and reports each page", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes("/failed-page/")
    ? new Response(JSON.stringify({ error: { code: 100, message: "Page is unavailable" } }), { status: 400 })
    : Response.json({ id: `post-${String(url).includes("/first-page/") ? "first" : "last"}` });
  const db = { prepare: () => ({ bind: () => ({ run: async () => ({ success: true }) }) }) };
  try {
    const result = await marketingTestHelpers.publishFacebookPages(
      {}, db, "post-id", ["first-page", "failed-page", "last-page"],
      { image: "https://example.com/dog.jpg" }, "caption", "https://bingodogwash.com/api/marketing/track?campaign=test", "T".repeat(50),
    );
    assert.equal(result.status, "partial");
    assert.deepEqual(result.succeededPages, ["first-page", "last-page"]);
    assert.deepEqual(result.failedPages, ["failed-page"]);
    assert.equal(result.pages["failed-page"].error, "Page is unavailable");
  } finally { globalThis.fetch = originalFetch; }
});

test("Instagram image validation rejects unsupported files and accepts public JPEG responses", async () => {
  assert.match((await marketingTestHelpers.validateInstagramImage("https://example.com/catalogue.pdf")).reason, /Unsupported/);
  assert.match((await marketingTestHelpers.validateInstagramImage("https://example.com/download/photo.jpg?download=1")).reason, /Download/);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 200, headers: { "Content-Type": "image/jpeg" } });
  try {
    assert.deepEqual(await marketingTestHelpers.validateInstagramImage("https://example.com/photo.jpg"), { ok: true, contentType: "image/jpeg" });
  } finally { globalThis.fetch = originalFetch; }
});

test("tracking redirect page is mobile-safe and never exposes a direct social supplier link", () => {
  const tracked = marketingTestHelpers.campaignUrl("https://etsy.com/listing/123", "campaign-redirect", "instagram");
  assert.equal(new URL(tracked).origin, "https://bingodogwash.com");
  assert.equal(new URL(tracked).searchParams.get("platform"), "instagram");
  const response = marketingTestHelpers.redirectPage("https://etsy.com/listing/123");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /text\/html/);
});

test("tracking GET records both click and redirect with campaign, platform and product metadata", async () => {
  const writes = [];
  const db = {
    prepare(sql) {
      return {
        bind(...values) {
          if (sql.startsWith("SELECT")) return { first: async () => ({ id: "post-1", product_id: "product-7", product_url: marketingTestHelpers.campaignUrl("https://etsy.com/listing/7", "campaign-events") }) };
          return { run: async () => { writes.push({ sql, values }); return { success: true }; } };
        },
      };
    },
  };
  const url = marketingTestHelpers.campaignUrl("https://etsy.com/listing/7", "campaign-events", "facebook");
  const response = await handleMarketingRequest(new Request(url), { GIFT_CARD_DB: db });
  assert.equal(response.status, 200);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].values[3], "click");
  assert.equal(writes[0].values[4], "facebook");
  assert.deepEqual(JSON.parse(writes[0].values[5]), { campaign: "campaign-events", platform: "facebook", product: "product-7" });
  assert.match(writes[1].sql, /'redirect'/);
});

test("removed controlled Instagram endpoint returns 404 without touching the guard table", async () => {
  let databaseCalls = 0;
  const db = { prepare() { databaseCalls += 1; throw new Error("unexpected database access"); } };
  const response = await handleMarketingRequest(new Request("https://bingodogwash.com/api/admin/marketing/instagram-controlled-test", {
    method: "POST",
    headers: { Authorization: "Bearer admin-token" },
  }), { ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: db });
  assert.equal(response.status, 404);
  assert.equal(databaseCalls, 0);
});

test("normal Instagram publishing logs only sanitized provider diagnostics", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs = [];
  console.error = (value) => logs.push(String(value));
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { code: 190, error_subcode: 463, message: "RAW_PROVIDER_SECRET" },
  }), { status: 400, headers: { "Content-Type": "application/json" } });
  try {
    await assert.rejects(
      marketingTestHelpers.publishInstagram({ META_INSTAGRAM_USER_ID: "private-account-id" }, "https://example.com/image.jpg", "private caption", "T".repeat(50)),
      /Meta connection has expired or is invalid/,
    );
    assert.equal(logs.length, 1);
    assert.deepEqual(JSON.parse(logs[0]), {
      event: "meta_api_failure",
      operation: "media_create",
      providerHttpStatus: 400,
      providerErrorCode: 190,
      providerErrorSubcode: 463,
      category: "provider_error",
    });
    assert.doesNotMatch(logs[0], /RAW_PROVIDER_SECRET|private-account-id|private caption|TTTT/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test("Instagram diagnostics distinguish publish, network, non-JSON, malformed, and identity failures", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs = [];
  console.error = (value) => logs.push(JSON.parse(String(value)));
  try {
    let requests = 0;
    globalThis.fetch = async () => {
      requests += 1;
      return requests === 1
        ? Response.json({ id: "container-id" })
        : new Response(JSON.stringify({ error: { code: 10, error_subcode: 2207001, message: "private provider message" } }), { status: 403 });
    };
    await assert.rejects(marketingTestHelpers.publishInstagram({ META_INSTAGRAM_USER_ID: "private-id" }, "/image.jpg", "caption", "S".repeat(50)), /permission/);
    assert.deepEqual(logs.pop(), { event: "meta_api_failure", operation: "media_publish", providerHttpStatus: 403, providerErrorCode: 10, providerErrorSubcode: 2207001, category: "provider_error" });

    globalThis.fetch = async () => new Response("not json", { status: 502 });
    await assert.rejects(marketingTestHelpers.publishInstagram({ META_INSTAGRAM_USER_ID: "private-id" }, "/image.jpg", "caption", "S".repeat(50)), /temporarily unavailable/);
    assert.equal(logs.pop().category, "non_json");

    globalThis.fetch = async () => Response.json({ accepted: true });
    await assert.rejects(marketingTestHelpers.publishInstagram({ META_INSTAGRAM_USER_ID: "private-id" }, "/image.jpg", "caption", "S".repeat(50)), /account connection is incomplete/);
    assert.equal(logs.pop().category, "malformed_response");

    globalThis.fetch = async () => { const error = new Error("private network detail"); error.name = "TimeoutError"; throw error; };
    await assert.rejects(marketingTestHelpers.publishInstagram({ META_INSTAGRAM_USER_ID: "private-id" }, "/image.jpg", "caption", "S".repeat(50)), /temporarily unavailable/);
    assert.equal(logs.pop().category, "timeout");

    globalThis.fetch = async () => Response.json({ username: "expected-user", account_type: "BUSINESS" });
    const identity = await marketingTestHelpers.instagramPreflight({ INSTAGRAM_ACCESS_TOKEN: "S".repeat(50), META_INSTAGRAM_USER_ID: "expected-id", META_INSTAGRAM_USERNAME: "expected-user" });
    assert.equal(identity.ok, false);
    const identityLog = logs.pop();
    assert.equal(identityLog.operation, "identity");
    assert.equal(identityLog.category, "malformed_response");
    assert.doesNotMatch(JSON.stringify(logs), /private provider message|private network detail|private-id|SSSS/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test("pause and resume admin actions update only the enabled setting", async () => {
  let enabled = 1;
  const db = { prepare(sql) { return { first: async () => ({ enabled, schedule_hour_utc: 9, schedule_minute_utc: 0, last_run_date: "", next_run_at: "" }), bind(value) { if (sql.startsWith("UPDATE marketing_settings")) enabled = Number(value); return { run: async () => ({ success: true }) }; } }; } };
  const request = (action) => new Request(`https://bingodogwash.com/api/admin/marketing/${action}`, { method: "POST", headers: { Authorization: "Bearer test-token" } });
  let response = await handleMarketingRequest(request("pause"), { ADMIN_API_TOKEN: "test-token", GIFT_CARD_DB: db }); assert.equal(response.status, 200); assert.equal((await response.json()).settings.enabled, false);
  response = await handleMarketingRequest(request("resume"), { ADMIN_API_TOKEN: "test-token", GIFT_CARD_DB: db }); assert.equal(response.status, 200); assert.equal((await response.json()).settings.enabled, true);
});

test("test-post admin action remains blocked while paused", async () => {
  const db = { prepare: () => ({ first: async () => ({ enabled: 0, schedule_hour_utc: 9, schedule_minute_utc: 0 }) }) };
  const response = await handleMarketingRequest(new Request("https://bingodogwash.com/api/admin/marketing/test", { method: "POST", headers: { Authorization: "Bearer test-token" } }), { ADMIN_API_TOKEN: "test-token", GIFT_CARD_DB: db });
  assert.deepEqual(await response.json(), { ok: true, status: "paused", skipped: "paused" });
});

test("publishing-disabled blocks test, resume, schedule, and direct automation paths", async () => {
  let writes = 0;
  const db = { prepare: () => ({ first: async () => ({ enabled: 0 }), bind: () => ({ run: async () => { writes += 1; return { success: true }; } }) }) };
  const env = { ADMIN_API_TOKEN: "test-token", GIFT_CARD_DB: db, MARKETING_PUBLISHING_DISABLED: "true" };
  const adminRequest = (action) => new Request(`https://staging.example/api/admin/marketing/${action}`, { method: "POST", headers: { Authorization: "Bearer test-token" } });

  let response = await handleMarketingRequest(adminRequest("test"), env);
  assert.equal(response.status, 423);
  assert.equal((await response.json()).skipped, "publishing-disabled");

  response = await handleMarketingRequest(adminRequest("resume"), env);
  assert.equal(response.status, 423);
  assert.equal((await response.json()).skipped, "publishing-disabled");

  assert.deepEqual(await runMarketingSchedule({ scheduledTime: Date.now() }, env), { ok: true, skipped: "publishing-disabled" });
  assert.deepEqual(await runMarketingAutomation(env), { ok: false, status: "disabled", skipped: "publishing-disabled", error: "Publishing is disabled in this environment." });
  assert.equal(writes, 0);
});

test("isolated staging worker exposes only health, assets, and protected marketing routes", async () => {
  let assetRequests = 0;
  const env = {
    ADMIN_API_TOKEN: "test-token",
    GIFT_CARD_DB: { prepare: () => ({ first: async () => ({ enabled: 0 }) }) },
    ASSETS: { fetch: async () => { assetRequests += 1; return new Response("asset"); } },
  };

  let response = await marketingStagingWorker.fetch(new Request("https://staging.example/health"), env);
  assert.deepEqual(await response.json(), { ok: true, environment: "marketing-staging", publishingDisabled: true });

  response = await marketingStagingWorker.fetch(new Request("https://staging.example/admin-marketing.html"), env);
  assert.equal(response.status, 200);
  assert.equal(assetRequests, 1);

  response = await marketingStagingWorker.fetch(new Request("https://staging.example/admin-marketing"), env);
  assert.equal(response.status, 200);
  assert.equal(assetRequests, 2);

  response = await marketingStagingWorker.fetch(new Request("https://staging.example/admin/marketing.html"), env);
  assert.equal(response.status, 200);
  assert.equal(assetRequests, 3);

  response = await marketingStagingWorker.fetch(new Request("https://staging.example/api/admin/marketing/test", { method: "POST", headers: { Authorization: "Bearer test-token" } }), env);
  assert.equal(response.status, 423);

  response = await marketingStagingWorker.fetch(new Request("https://staging.example/api/admin/marketing/resume", { method: "POST", headers: { Authorization: "Bearer test-token" } }), env);
  assert.equal(response.status, 423);

  response = await marketingStagingWorker.fetch(new Request("https://staging.example/api/admin/gift-cards"), env);
  assert.equal(response.status, 404);
});

test("safe preflight refuses to run while automation is active and makes no Meta request", async () => {
  const originalFetch = globalThis.fetch; let requests = 0; globalThis.fetch = async () => { requests += 1; throw new Error("unexpected request"); };
  const db = { prepare: () => ({ first: async () => ({ enabled: 1, schedule_hour_utc: 9, schedule_minute_utc: 0 }) }) };
  try {
    const response = await handleMarketingRequest(new Request("https://bingodogwash.com/api/admin/marketing/preflight", { method: "POST", headers: { Authorization: "Bearer test-token" } }), { ADMIN_API_TOKEN: "test-token", GIFT_CARD_DB: db });
    assert.equal(response.status, 409); assert.deepEqual(await response.json(), { ok: false, error: "Pause automation before running preflight.", paused: false }); assert.equal(requests, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("platform-specific failure produces a partial result with separated APIs and IDs", async () => {
  const originalFetch = globalThis.fetch; const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    if (!String(url).includes("graph.")) return new Response(null, { status: 200, headers: { "Content-Type": "image/jpeg" } });
    return String(url).includes("/27879594505014566/media")
      ? new Response(JSON.stringify({ error: { code: 190, type: "OAuthException" } }), { status: 400 })
      : Response.json({ id: "facebook-post-id" });
  };
  const product = { source: "etsy", id: "p1", name: "Dog Shampoo", description: "gentle cleaning", price: 999, currency: "GBP", category: "Grooming", stock: 2, url: "https://bingodogwash.com/product.html?id=p1", image: "https://bingodogwash.com/shampoo.jpg" };
  const db = { prepare(sql) { return { first: async () => sql.includes("marketing_settings") ? { enabled: 1, schedule_hour_utc: 9, schedule_minute_utc: 0 } : product, bind: () => ({ run: async () => ({ success: true }) }) }; } };
  try {
    const result = await runMarketingAutomation({ GIFT_CARD_DB: db, META_PAGE_ID: "1264938680034651", META_PAGE_ACCESS_TOKEN: "F".repeat(50), META_INSTAGRAM_USER_ID: "27879594505014566", INSTAGRAM_ACCESS_TOKEN: "I".repeat(50) }, { trigger: "test" });
    assert.equal(result.status, "partial"); assert.equal(result.platforms.facebook.ok, true); assert.equal(result.platforms.instagram.ok, false); assert.equal(result.platforms.instagram.attempts, 1);
    assert.equal(urls.some((url) => url.includes("graph.facebook.com/v25.0/1264938680034651/photos")), true);
    assert.equal(urls.some((url) => url.includes("graph.instagram.com/v26.0/27879594505014566/media")), true);
  } finally { globalThis.fetch = originalFetch; }
});
