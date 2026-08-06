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

test("Marketing Admin always exposes the existing Meta reconnect flow", () => {
  const html = readFileSync(new URL("../public/admin/marketing.html", import.meta.url), "utf8");
  const frontend = readFileSync(new URL("../public/admin/marketing.js", import.meta.url), "utf8");
  assert.match(html, /data-action="oauth-start"/);
  assert.match(html, /Reconnect Facebook \/ Meta/);
  assert.match(frontend, /call\("\/oauth\/start"/);
  assert.match(frontend, /window\.location\.assign\(result\.url\)/);
  assert.match(frontend, /showOAuthCallbackStatus/);
  assert.match(frontend, /Meta credential stored, but managed Page discovery needs attention/);
  assert.match(frontend, /oauthCallbackResult/);
  assert.match(frontend, /Meta code/);
  assert.doesNotMatch(frontend, /safePreflightResult/);
  assert.match(frontend, /return data;\/\/|return data;/);
});

test("OAuth start reuses the protected route and returns a Facebook authorization URL", async () => {
  let storedState = "";
  const db = { prepare: () => ({ bind: (key) => ({ run: async () => { storedState = key; return { success: true }; } }) }) };
  const response = await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/start", {
    method: "POST",
    headers: { Authorization: "Bearer admin-token" },
  }), { ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: db, META_APP_ID: "app-id" });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(new URL(body.url).hostname, "www.facebook.com");
  assert.match(storedState, /^oauth_state:/);
});

test("OAuth callback uses its one-time state guard instead of a missing browser bearer header", async () => {
  const db = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
  const response = await handleMarketingRequest(
    new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/callback?state=unknown&code=test"),
    { ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: db },
  );
  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get("Location")).searchParams.get("oauth"), "invalid_state");
});

test("OAuth callback stores the long-lived user credential in D1 rather than a Page token", async () => {
  const originalFetch = globalThis.fetch;
  const storedValues = [];
  const db = { prepare(sql) { return {
    bind(...values) {
      if (sql.includes("RETURNING created_at")) return { first: async () => ({ created_at: new Date().toISOString() }) };
      if (sql.includes("INSERT INTO marketing_connections")) return { run: async () => { storedValues.push(...values); return { success: true }; } };
      return { run: async () => ({ success: true }) };
    },
    run: async () => ({ success: true }),
  }; } };
  let request = 0;
  globalThis.fetch = async () => {
    request += 1;
    if (request === 1) return Response.json({ access_token: "short-user-token" });
    if (request === 2) return Response.json({ access_token: "long-user-token", expires_in: 5000 });
    return Response.json({ data: [{ id: "page-1", access_token: "page-one-token" }] });
  };
  try {
    const response = await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/callback?state=valid&code=code"), {
      GIFT_CARD_DB: db, META_APP_ID: "app", META_APP_SECRET: "secret", META_PAGE_ID: "page-1",
    });
    assert.equal(new URL(response.headers.get("Location")).searchParams.get("oauth"), "success");
    assert.equal(storedValues.length, 5);
    assert.equal(storedValues[0], "long-user-token");
    assert.equal(storedValues[2], null);
    assert.equal(storedValues[3], null);
    assert.match(storedValues[4], /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(storedValues.includes("page-one-token"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("OAuth callback stores the user credential even when /me/accounts returns no Pages", async () => {
  const originalFetch = globalThis.fetch;
  const storedValues = [];
  const db = { prepare(sql) { return {
    bind(...values) {
      if (sql.includes("RETURNING created_at")) return { first: async () => ({ created_at: new Date().toISOString() }) };
      if (sql.includes("INSERT INTO marketing_connections")) return { run: async () => { storedValues.push(...values); return { success: true }; } };
      return { run: async () => ({ success: true }) };
    },
    run: async () => ({ success: true }),
  }; } };
  let request = 0;
  globalThis.fetch = async () => {
    request += 1;
    if (request === 1) return Response.json({ access_token: "short-user-token" });
    if (request === 2) return Response.json({ access_token: "long-user-token", expires_in: 5000 });
    return Response.json({ data: [] });
  };
  try {
    const response = await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/callback?state=valid&code=code"), {
      GIFT_CARD_DB: db, META_APP_ID: "app", META_APP_SECRET: "secret", META_PAGE_ID: "page-1",
    });
    const location = new URL(response.headers.get("Location"));
    assert.equal(location.searchParams.get("oauth"), "success");
    assert.equal(location.searchParams.get("discovery"), "no_pages");
    assert.equal(storedValues[0], "long-user-token");
  } finally { globalThis.fetch = originalFetch; }
});

test("OAuth callback reports a safe token-exchange failure stage without exposing credentials", async () => {
  const originalFetch = globalThis.fetch;
  const db = { prepare: () => ({ bind: () => ({ first: async () => ({ created_at: new Date().toISOString() }), run: async () => ({ success: true }) }) }) };
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 100, type: "OAuthException", error_subcode: 36008, message: "The authorization code secret-code is invalid or expired." } }), { status: 400 });
  try {
    const response = await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/callback?state=valid&code=secret-code"), {
      GIFT_CARD_DB: db, META_APP_ID: "app", META_APP_SECRET: "secret",
    });
    const location = new URL(response.headers.get("Location"));
    assert.equal(location.searchParams.get("oauth"), "error");
    assert.equal(location.searchParams.get("stage"), "code_exchange");
    assert.equal(location.searchParams.get("providerCode"), "100");
    assert.equal(location.searchParams.get("httpStatus"), "400");
    assert.equal(location.searchParams.get("providerType"), "OAuthException");
    assert.equal(location.searchParams.get("providerSubcode"), "36008");
    assert.match(location.searchParams.get("providerMessage"), /\[redacted\]/);
    assert.equal(location.searchParams.get("appIdConfigured"), "true");
    assert.equal(location.searchParams.get("appSecretConfigured"), "true");
    assert.equal(location.searchParams.get("redirectUriUsed"), "https://admin.bingodogwash.com/api/admin/marketing/oauth/callback");
    assert.equal(location.searchParams.get("graphHost"), "graph.facebook.com");
    assert.equal(location.searchParams.get("graphApiVersion"), "v25.0");
    assert.equal(location.searchParams.get("requestMethod"), "POST");
    assert.equal(location.toString().includes("secret-code"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("OAuth login and code exchange use the exact same configured redirect URI with form encoding", async () => {
  const originalFetch = globalThis.fetch;
  const redirectUri = "https://admin.bingodogwash.com/api/admin/marketing/oauth/callback";
  let exchangedUrl = "";
  let exchangedOptions;
  const db = { prepare(sql) { return { bind: (key) => sql.includes("INSERT OR REPLACE")
    ? ({ run: async () => ({ success: true }) })
    : ({ first: async () => ({ created_at: new Date().toISOString(), key }) }) }; } };
  globalThis.fetch = async (url, options) => {
    exchangedUrl = String(url); exchangedOptions = options;
    return new Response(JSON.stringify({ error: { code: 100, type: "OAuthException", message: "Redirect URI mismatch" } }), { status: 400 });
  };
  try {
    const start = await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/start", { method: "POST", headers: { Authorization: "Bearer admin" } }), { ADMIN_API_TOKEN: "admin", GIFT_CARD_DB: db, META_APP_ID: "app", META_REDIRECT_URI: redirectUri });
    const loginRedirect = new URL((await start.json()).url).searchParams.get("redirect_uri");
    await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/callback?state=valid&code=one-time-code"), { GIFT_CARD_DB: db, META_APP_ID: "app", META_APP_SECRET: "secret", META_REDIRECT_URI: redirectUri });
    assert.equal(loginRedirect, redirectUri);
    assert.equal(new URLSearchParams(exchangedOptions.body).get("redirect_uri"), redirectUri);
    assert.equal(exchangedOptions.method, "POST");
    assert.equal(exchangedOptions.headers["Content-Type"], "application/x-www-form-urlencoded");
    assert.equal(exchangedUrl, "https://graph.facebook.com/v25.0/oauth/access_token");
    assert.equal(exchangedUrl.includes("one-time-code"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("OAuth callback fails before a request when the production app secret is missing", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; throw new Error("unexpected request"); };
  const db = { prepare: () => ({ bind: () => ({ first: async () => ({ created_at: new Date().toISOString() }) }) }) };
  try {
    const response = await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/callback?state=valid&code=code"), { GIFT_CARD_DB: db, META_APP_ID: "app" });
    assert.equal(new URL(response.headers.get("Location")).searchParams.get("oauth"), "server_error");
    assert.equal(requests, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("OAuth callback atomically consumes state and refuses a duplicate callback", async () => {
  const originalFetch = globalThis.fetch;
  let guardAvailable = true;
  let requests = 0;
  const db = { prepare(sql) { return {
    bind(...values) {
      if (sql.includes("RETURNING created_at")) return { first: async () => { if (!guardAvailable) return null; guardAvailable = false; return { created_at: new Date().toISOString() }; } };
      if (sql.includes("INSERT INTO marketing_connections")) return { run: async () => ({ success: true, values }) };
      return { run: async () => ({ success: true }) };
    }, run: async () => ({ success: true }),
  }; } };
  globalThis.fetch = async () => { requests += 1; return requests === 1 ? Response.json({ access_token: "short-user-token" }) : requests === 2 ? Response.json({ access_token: "long-user-token", expires_in: 5000 }) : Response.json({ data: [] }); };
  try {
    const request = () => new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/callback?state=once&code=single-use-code");
    const first = await handleMarketingRequest(request(), { GIFT_CARD_DB: db, META_APP_ID: "app", META_APP_SECRET: "secret" });
    const second = await handleMarketingRequest(request(), { GIFT_CARD_DB: db, META_APP_ID: "app", META_APP_SECRET: "secret" });
    assert.equal(new URL(first.headers.get("Location")).searchParams.get("oauth"), "success");
    assert.equal(new URL(second.headers.get("Location")).searchParams.get("oauth"), "invalid_state");
    assert.equal(requests, 3);
  } finally { globalThis.fetch = originalFetch; }
});

test("OAuth callback rejects an expired state before exchanging its authorization code", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; throw new Error("unexpected request"); };
  const db = { prepare: () => ({ bind: () => ({ first: async () => ({ created_at: new Date(Date.now() - 11 * 60 * 1000).toISOString() }) }) }) };
  try {
    const response = await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/callback?state=old&code=expired-code"), { GIFT_CARD_DB: db, META_APP_ID: "app", META_APP_SECRET: "secret" });
    assert.equal(new URL(response.headers.get("Location")).searchParams.get("stage"), "expired_state");
    assert.equal(requests, 0);
  } finally { globalThis.fetch = originalFetch; }
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
    assert.equal(result.ok, false);
    assert.equal(result.error, "Meta connection has expired or is invalid. Reconnect Meta in server settings.");
    assert.equal(result.attempts, 1);
    assert.equal(result.diagnostic.providerErrorCode, 190);
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
    assert.equal(result.ok, false);
    assert.equal(result.error, "Meta connection has expired or is invalid. Reconnect Meta in server settings.");
    assert.equal(result.diagnostic.providerErrorCode, 190);
    assert.equal(requests, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("Instagram preflight treats a validated Instagram Login identity as publishable", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(String(url)); return Response.json({ id: "27879594505014566", username: "bingo_dogwash", account_type: "MEDIA_CREATOR" }); };
  try {
    const result = await marketingTestHelpers.instagramPreflight({ INSTAGRAM_ACCESS_TOKEN: "A".repeat(50), META_INSTAGRAM_USER_ID: "27879594505014566", META_INSTAGRAM_USERNAME: "bingo_dogwash" });
    assert.equal(result.ok, true);
    assert.equal(result.authenticationOk, true);
    assert.equal(result.identityOk, true);
    assert.equal(result.username, "bingo_dogwash");
    assert.equal(result.publishingPermission, "identity-verified");
    assert.equal(urls.some((url) => url.includes("/me/permissions")), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("Instagram preflight validates the configured Login API user", async () => {
  const originalFetch = globalThis.fetch; const urls = [];
  globalThis.fetch = async (url, options) => {
    urls.push(String(url)); assert.match(options.headers.Authorization, /^Bearer A+$/);
    return Response.json({ id: "27879594505014566", username: "bingo_dogwash", account_type: "MEDIA_CREATOR" });
  };
  try {
    const result = await marketingTestHelpers.instagramPreflight({ INSTAGRAM_ACCESS_TOKEN: "A".repeat(50), META_INSTAGRAM_USER_ID: "27879594505014566", META_INSTAGRAM_USERNAME: "bingo_dogwash" });
    assert.equal(result.ok, true); assert.equal(result.username, "bingo_dogwash"); assert.equal(result.accountType, "MEDIA_CREATOR"); assert.equal(result.publishingPermission, "identity-verified");
    assert.equal(urls.some((url) => url.startsWith("https://graph.instagram.com/v26.0/me")), true);
  } finally { globalThis.fetch = originalFetch; }
});

test("Meta preflight distinguishes identity, permission, and network failures safely", async () => {
  const originalFetch = globalThis.fetch;
  const env = { INSTAGRAM_ACCESS_TOKEN: "A".repeat(50), META_INSTAGRAM_USER_ID: "expected-id", META_INSTAGRAM_USERNAME: "expected-user" };
  try {
    globalThis.fetch = async () => Response.json({ id: "different-id", username: "expected-user", account_type: "BUSINESS" });
    assert.equal((await marketingTestHelpers.instagramPreflight(env)).error, "Instagram token belongs to a different account.");

    globalThis.fetch = async () => Response.json({ id: "expected-id", username: "expected-user", account_type: "PERSONAL" });
    assert.equal((await marketingTestHelpers.instagramPreflight(env)).identityOk, false);

    globalThis.fetch = async () => { throw new TypeError("provider detail"); };
    assert.equal((await marketingTestHelpers.instagramPreflight(env)).error, "Meta service is temporarily unavailable.");
  } finally { globalThis.fetch = originalFetch; }
});

test("Facebook single-Page preflight validates only the primary Page without /me/accounts", async () => {
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
    assert.equal(result.singlePageMode, true);
    assert.equal(result.statusMessage, "Single-Page mode active — Facebook Page 1264938680034651");
    assert.deepEqual(result.requiredPermissions, ["pages_manage_posts"]);
    assert.equal(urls.some((url) => url.includes("/debug_token")), true);
    assert.equal(urls.some((url) => url.includes("/me?")), true);
    assert.equal(urls.some((url) => url.includes("/me/accounts")), false);
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

test("production configuration enables only the confirmed primary Facebook Page", () => {
  const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(config.vars.META_PAGE_ID, "1264938680034651");
  assert.equal(config.vars.META_PAGE_IDS, "1264938680034651");
  assert.equal(config.vars.META_PAGE_IDS.includes("61592339597666"), false);
  assert.equal(config.vars.META_PAGE_IDS.includes("61590905394658"), false);
});

test("single-Page publishing sends one post only to the confirmed primary Page", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(String(url)); return Response.json({ id: "primary-post" }); };
  const db = { prepare: () => ({ bind: () => ({ run: async () => ({ success: true }) }) }) };
  try {
    const result = await marketingTestHelpers.publishFacebookPages({}, db, "post-id", [
      { ok: true, pageId: "1264938680034651", token: "P".repeat(50), tokenSource: "secret:page_token" },
    ], { image: "https://example.com/dog.jpg" }, "caption", "https://bingodogwash.com/api/marketing/track?campaign=test", "secret");
    assert.equal(result.status, "success");
    assert.deepEqual(result.succeededPages, ["1264938680034651"]);
    assert.equal(urls.length, 1);
    assert.match(urls[0], /\/1264938680034651\/photos/);
    assert.equal(urls[0].includes("61592339597666"), false);
    assert.equal(urls[0].includes("61590905394658"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("Facebook multi-page publishing continues after a page fails and reports each page", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).includes("/failed-page/")
    ? new Response(JSON.stringify({ error: { code: 100, message: "Page is unavailable" } }), { status: 400 })
    : Response.json({ id: `post-${String(url).includes("/first-page/") ? "first" : "last"}` });
  const db = { prepare: () => ({ bind: () => ({ run: async () => ({ success: true }) }) }) };
  try {
    const result = await marketingTestHelpers.publishFacebookPages(
      {}, db, "post-id", [
        { ok: true, pageId: "first-page", token: "T".repeat(50) },
        { ok: false, pageId: "failed-page", error: "Page is unavailable" },
        { ok: true, pageId: "last-page", token: "T".repeat(50) },
      ],
      { image: "https://example.com/dog.jpg" }, "caption", "https://bingodogwash.com/api/marketing/track?campaign=test", "secret",
    );
    assert.equal(result.status, "partial");
    assert.deepEqual(result.succeededPages, ["first-page", "last-page"]);
    assert.deepEqual(result.failedPages, ["failed-page"]);
    assert.equal(result.pages["failed-page"].error, "Page is unavailable");
  } finally { globalThis.fetch = originalFetch; }
});

test("Facebook publishing uses each Page's own /me/accounts token", async () => {
  const originalFetch = globalThis.fetch;
  const authorizations = [];
  globalThis.fetch = async (_url, options) => { authorizations.push(options.headers.Authorization); return Response.json({ id: `post-${authorizations.length}` }); };
  const db = { prepare: () => ({ bind: () => ({ run: async () => ({ success: true }) }) }) };
  try {
    const result = await marketingTestHelpers.publishFacebookPages({}, db, "post-id", [
      { ok: true, pageId: "page-1", token: "P".repeat(50), tokenSource: "d1:me/accounts", returnedByAccounts: true },
      { ok: true, pageId: "page-2", token: "Q".repeat(50), tokenSource: "d1:me/accounts", returnedByAccounts: true },
      { ok: true, pageId: "page-3", token: "R".repeat(50), tokenSource: "d1:me/accounts", returnedByAccounts: true },
    ], { image: "https://example.com/dog.jpg" }, "caption", "https://bingodogwash.com/api/marketing/track?campaign=test", "d1");
    assert.equal(result.status, "success");
    assert.deepEqual(authorizations, [`Bearer ${"P".repeat(50)}`, `Bearer ${"Q".repeat(50)}`, `Bearer ${"R".repeat(50)}`]);
  } finally { globalThis.fetch = originalFetch; }
});

test("valid Facebook user token reports an ID absent from /me/accounts without probing or calling it expired", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; return Response.json({ data: [{ id: "authorised-page", access_token: "P".repeat(50) }] }); };
  try {
    const pages = await marketingTestHelpers.resolveFacebookPageAccess("U".repeat(50), ["authorised-page", "inaccessible-page"]);
    assert.equal(pages[0].ok, true);
    assert.equal(pages[1].ok, false);
    assert.equal(pages[1].returnedByAccounts, false);
    assert.equal(pages[1].possibleProfileId, true);
    assert.match(pages[1].error, /profile ID|does not manage/);
    assert.equal(requests, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("Instagram image publishing OAuthException is preserved when it is not code 190", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 36003, type: "OAuthException", message: "Image aspect ratio is not supported" } }), { status: 400 });
  try {
    await assert.rejects(
      marketingTestHelpers.publishInstagram({ META_INSTAGRAM_USER_ID: "instagram-id" }, "https://example.com/image.jpg", "caption", "I".repeat(50)),
      /Image aspect ratio is not supported/,
    );
  } finally { globalThis.fetch = originalFetch; }
});

test("Instagram preflight can pass while a later media publish fails for a non-token reason", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (url) => {
    requests += 1;
    if (String(url).includes("/me?")) {
      return Response.json({ id: "instagram-id", username: "bingo", account_type: "BUSINESS" });
    }
    return new Response(JSON.stringify({ error: { code: 36003, type: "OAuthException", message: "Image aspect ratio is not supported" } }), { status: 400 });
  };
  const env = { INSTAGRAM_ACCESS_TOKEN: "I".repeat(50), META_INSTAGRAM_USER_ID: "instagram-id", META_INSTAGRAM_USERNAME: "bingo" };
  try {
    assert.equal((await marketingTestHelpers.instagramPreflight(env)).ok, true);
    await assert.rejects(marketingTestHelpers.publishInstagram(env, "https://example.com/image.jpg", "caption", "I".repeat(50)), /Image aspect ratio is not supported/);
    assert.equal(requests, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("successful Instagram publishing returns the published media ID", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; return Response.json({ id: requests === 1 ? "container-id" : "instagram-post-id" }); };
  try {
    assert.equal(await marketingTestHelpers.publishInstagram({ META_INSTAGRAM_USER_ID: "instagram-id" }, "https://example.com/image.jpg", "caption", "I".repeat(50)), "instagram-post-id");
    assert.equal(requests, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("newer D1 Facebook token is validated before an older Cloudflare secret", async () => {
  const originalFetch = globalThis.fetch;
  const storedToken = "D".repeat(50);
  const secretToken = "S".repeat(50);
  let authorization = "";
  globalThis.fetch = async (_url, options) => { authorization = options.headers.Authorization; return Response.json({ data: { is_valid: true, scopes: ["pages_manage_posts"] } }); };
  const db = { prepare: () => ({ first: async () => ({ page_access_token: storedToken, updated_at: "2026-08-04T06:40:00Z" }) }) };
  try {
    const connection = await marketingTestHelpers.resolveMetaConnection({ GIFT_CARD_DB: db, META_PAGE_ACCESS_TOKEN: secretToken, META_PAGE_ID: "page-id" }, "facebook");
    assert.equal(connection.ok, true);
    assert.equal(connection.source, "d1");
    assert.equal(authorization, `Bearer ${storedToken}`);
  } finally { globalThis.fetch = originalFetch; }
});

test("D1 OAuth user credential is preferred and /me/accounts provides a separate token for three Pages", async () => {
  const originalFetch = globalThis.fetch;
  const storedToken = "D".repeat(50);
  const secretToken = "S".repeat(50);
  globalThis.fetch = async (url, options) => {
    const token = options.headers.Authorization.slice("Bearer ".length);
    if (String(url).includes("/debug_token")) return Response.json({ data: { is_valid: true, type: token === storedToken ? "USER" : "PAGE", scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"] } });
    if (String(url).includes("/me/accounts")) return Response.json({ data: [
      { id: "page-1", access_token: "P".repeat(50) },
      { id: "page-2", access_token: "Q".repeat(50) },
      { id: "page-3", access_token: "R".repeat(50) },
    ] });
    throw new Error("secret fallback must not be used");
  };
  const db = { prepare: () => ({ first: async () => ({ page_access_token: storedToken, updated_at: "2026-08-04T06:40:00Z" }) }) };
  try {
    const result = await marketingTestHelpers.resolveFacebookPublishingContext({ GIFT_CARD_DB: db, META_PAGE_ACCESS_TOKEN: secretToken, META_PAGE_IDS: "page-1,page-2,page-3" }, ["page-1", "page-2", "page-3"]);
    assert.equal(result.connection.source, "d1");
    assert.equal(result.userCredentialSource, "d1");
    assert.equal(result.accountsRequest.ok, true);
    assert.equal(result.pageAccess.every((page) => page.ok), true);
    assert.equal(new Set(result.pageAccess.map((page) => page.token)).size, 3);
    assert.equal(result.pageAccess.every((page) => page.tokenSource === "d1:me/accounts"), true);
  } finally { globalThis.fetch = originalFetch; }
});

test("Cloudflare Page token fallback is restricted to its own Page and diagnostics expose no tokens", async () => {
  const originalFetch = globalThis.fetch;
  const secretToken = "SECRET-PAGE-" + "S".repeat(50);
  globalThis.fetch = async (url) => {
    if (String(url).includes("/debug_token")) return Response.json({ data: { is_valid: true, type: "PAGE", scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"] } });
    if (String(url).includes("/me?")) return Response.json({ id: "page-1", name: "First Page" });
    throw new Error("unexpected request");
  };
  try {
    const result = await marketingTestHelpers.facebookPreflight({ META_PAGE_ACCESS_TOKEN: secretToken, META_PAGE_IDS: "page-1,page-2" });
    assert.equal(result.tokenSource, "secret");
    assert.equal(result.userCredentialSource, "none");
    assert.equal(result.accountsRequest.attempted, false);
    assert.equal(result.pages["page-1"].ok, true);
    assert.equal(result.pages["page-1"].tokenSource, "secret:page_token");
    assert.equal(result.pages["page-2"].ok, false);
    assert.equal(result.pages["page-2"].classification, "not_available_to_page_token");
    assert.equal(JSON.stringify(result).includes(secretToken), false);
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
    const diagnostic = JSON.parse(logs[0]);
    assert.equal(diagnostic.operation, "media_create");
    assert.equal(diagnostic.accountId, "private-account-id");
    assert.equal(diagnostic.graphHost, "graph.instagram.com");
    assert.equal(diagnostic.graphApiVersion, "v26.0");
    assert.equal(diagnostic.providerErrorCode, 190);
    assert.equal(diagnostic.providerErrorSubcode, 463);
    assert.equal(diagnostic.safeErrorMessage, "Meta connection has expired or is invalid. Reconnect Meta in server settings.");
    assert.equal(diagnostic.graphRequestMade, true);
    assert.doesNotMatch(logs[0], /RAW_PROVIDER_SECRET|private caption|TTTT/);
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
    const publishDiagnostic = logs.pop();
    assert.equal(publishDiagnostic.operation, "media_publish");
    assert.equal(publishDiagnostic.accountId, "private-id");
    assert.equal(publishDiagnostic.providerHttpStatus, 403);
    assert.equal(publishDiagnostic.providerErrorCode, 10);
    assert.equal(publishDiagnostic.providerErrorSubcode, 2207001);
    assert.equal(publishDiagnostic.safeErrorMessage, "Meta connection does not have permission to publish.");

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
    assert.equal(identityLog.operation, "instagram_identity");
    assert.equal(identityLog.category, "malformed_response");
    assert.doesNotMatch(JSON.stringify(logs), /private provider message|private network detail|SSSS/);
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

test("authenticated controlled test can run while scheduling remains paused", async () => {
  let queries = 0;
  const db = { prepare(sql) { queries += 1; return { first: async () => sql.includes("marketing_settings") ? ({ enabled: 0, schedule_hour_utc: 9, schedule_minute_utc: 0 }) : null }; } };
  const response = await handleMarketingRequest(new Request("https://bingodogwash.com/api/admin/marketing/test", { method: "POST", headers: { Authorization: "Bearer test-token" } }), { ADMIN_API_TOKEN: "test-token", GIFT_CARD_DB: db });
  assert.deepEqual(await response.json(), { ok: false, error: "No published, in-stock products with an image and URL are available." });
  assert.equal(queries, 2);
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
    if (String(url).includes("/debug_token")) return Response.json({ data: { is_valid: true, type: "USER", scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"] } });
    if (String(url).includes("/me/accounts")) return Response.json({ data: [{ id: "1264938680034651", access_token: "P".repeat(50) }] });
    if (String(url).includes("graph.instagram.com/v26.0/me")) return Response.json({ id: "27879594505014566", username: "bingo_dogwash", account_type: "MEDIA_CREATOR" });
    if (String(url).includes("/27879594505014566/media")) return new Response(JSON.stringify({ error: { code: 190, type: "OAuthException" } }), { status: 400 });
    return Response.json({ id: "facebook-post-id" });
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
