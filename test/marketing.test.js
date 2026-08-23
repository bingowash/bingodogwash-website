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
  assert.match(frontend, /Next eligible product:/);
  assert.match(frontend, /7-day cooldown/);
  assert.doesNotMatch(frontend, /safePreflightResult/);
  assert.match(frontend, /return data;\/\/|return data;/);
});

test("Marketing Admin exposes separate primary and secondary Facebook controls and storage", () => {
  const html = readFileSync(new URL("../public/admin/marketing.html", import.meta.url), "utf8");
  const frontend = readFileSync(new URL("../public/admin/marketing.js", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../migrations/0024_secondary_facebook_connection.sql", import.meta.url), "utf8");
  assert.match(html, /Facebook Primary/);
  assert.match(html, /Facebook Secondary/);
  assert.match(html, /data-action="oauth-secondary-start"/);
  assert.match(frontend, /\/oauth\/secondary\/candidates/);
  assert.match(frontend, /\/oauth\/secondary\/select/);
  assert.match(migration, /marketing_facebook_connections/);
  assert.match(migration, /marketing_facebook_oauth_pages/);
  assert.match(migration, /page_access_token TEXT NOT NULL/);
});

test("temporary Instagram sharing test is absent while normal marketing controls remain", () => {
  const html = readFileSync(new URL("../public/admin/marketing.html", import.meta.url), "utf8");
  const frontend = readFileSync(new URL("../public/admin/marketing.js", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../_functions_NOT_FOR_STATIC_UPLOAD/api/marketing.js", import.meta.url), "utf8");
  for (const source of [html, frontend, worker]) {
    assert.doesNotMatch(source, /Instagram Accounts Centre sharing test/i);
    assert.doesNotMatch(source, /instagram-sharing-test/);
    assert.doesNotMatch(source, /instagram_accounts_centre_sharing/);
  }
  assert.match(html, /Run Safe Preflight/);
  assert.match(html, /Run Test Post/);
  assert.match(html, /Pause Automation/);
  assert.match(html, /Resume Automation/);
  assert.match(html, /View Logs/);
  assert.match(worker, /if \(url\.pathname === `\$\{ADMIN_PATH\}\/test`\)/);
  assert.match(worker, /publishingAttempted: false/);
  assert.match(worker, /return preflight\(env\)/);
  assert.match(worker, /async function publishInstagram\(/);
});

test("Instagram sharing cleanup preserves schedule, cron, supplier rotation, and Facebook collaboration controls", () => {
  const worker = readFileSync(new URL("../_functions_NOT_FOR_STATIC_UPLOAD/api/marketing.js", import.meta.url), "utf8");
  const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  const frontend = readFileSync(new URL("../public/admin/marketing.js", import.meta.url), "utf8");
  assert.match(worker, /const MARKETING_INTERVAL_HOURS = 4/);
  assert.deepEqual(config.triggers.crons, ["*/15 * * * *", "0 2 * * *", "30 3 * * *"]);
  assert.match(worker, /selectNextProduct\(db, \{\s*respectCooldown: options\.trigger === "scheduled"/);
  assert.match(frontend, /Collaborator follow-up:/);
  assert.match(frontend, /Mark completed/);
});

test("Facebook Primary collaboration follow-up is additive and local-only", () => {
  const frontend = readFileSync(new URL("../public/admin/marketing.js", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../migrations/0025_facebook_collaboration_followups.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS marketing_facebook_collaboration_followups/);
  assert.match(migration, /platform_result_id TEXT PRIMARY KEY/);
  assert.match(migration, /CHECK \(collaboration_state IN \('pending', 'completed'\)\)/);
  assert.doesNotMatch(migration, /\b(?:DELETE|DROP|ALTER)\b/i);
  assert.match(frontend, /Mark completed/);
  assert.match(frontend, /Reset pending/);
  assert.match(frontend, /\/facebook-collaboration/);
});

test("Facebook history defaults successful Primary follow-up to pending and failures to not applicable", () => {
  const primarySuccess = marketingTestHelpers.facebookHistoryDestination({ id: "r1", platform: "facebook:1264938680034651", status: "success", external_post_id: "photo-1", metadata: JSON.stringify({ connectionRole: "facebook_primary", pageId: "1264938680034651", pageName: "Bingo Dog Wash" }) });
  const primaryFailure = marketingTestHelpers.facebookHistoryDestination({ id: "r2", platform: "facebook:1264938680034651", status: "failed", metadata: "{}" });
  const secondarySuccess = marketingTestHelpers.facebookHistoryDestination({ id: "r3", platform: "facebook_secondary:2", status: "success", metadata: JSON.stringify({ connectionRole: "facebook_secondary", pageId: "2" }) });
  const completed = marketingTestHelpers.facebookHistoryDestination({ id: "r4", platform: "facebook:1264938680034651", status: "success", metadata: "{}", collaboration_state: "completed", collaboration_completed_at: "2026-08-22T12:00:00.000Z" });
  assert.equal(primarySuccess.collaborationState, "pending");
  assert.equal(primarySuccess.postUrl, "");
  assert.equal(primaryFailure.collaborationState, "not_applicable");
  assert.equal(secondarySuccess.collaborationState, "not_applicable");
  assert.equal(completed.collaborationState, "completed");
  assert.equal(completed.collaborationCompletedAt, "2026-08-22T12:00:00.000Z");
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

test("secondary Facebook OAuth is authenticated, Page-scoped, and does not request Instagram", async () => {
  let storedState = "";
  const db = { prepare: () => ({ bind: (key) => ({ run: async () => { storedState = key; return { success: true }; } }) }) };
  const unauthorized = await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/secondary/start", { method: "POST" }), { ADMIN_API_TOKEN: "admin", GIFT_CARD_DB: db, META_APP_ID: "app" });
  assert.equal(unauthorized.status, 401);
  const response = await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/secondary/start", { method: "POST", headers: { Authorization: "Bearer admin" } }), { ADMIN_API_TOKEN: "admin", GIFT_CARD_DB: db, META_APP_ID: "app" });
  const body = await response.json();
  const secondaryUrl = new URL(body.url);
  const scopes = secondaryUrl.searchParams.get("scope").split(",");
  assert.match(storedState, /^oauth_state:secondary\./);
  assert.equal(secondaryUrl.searchParams.get("auth_type"), "reauthorize");
  assert.equal(secondaryUrl.searchParams.has("login_hint"), false);
  assert.equal(secondaryUrl.searchParams.has("access_token"), false);
  assert.deepEqual(scopes, ["pages_manage_posts", "pages_read_engagement", "pages_show_list"]);
  assert.equal(scopes.includes("instagram_content_publish"), false);
  assert.equal(scopes.includes("business_management"), false);
});

test("primary OAuth remains session-compatible while secondary alone requires reauthorization", async () => {
  const states = [];
  const db = { prepare: () => ({ bind: (key) => ({ run: async () => { states.push(key); return { success: true }; } }) }) };
  const env = { ADMIN_API_TOKEN: "admin", GIFT_CARD_DB: db, META_APP_ID: "app" };
  const headers = { Authorization: "Bearer admin" };
  const primaryResponse = await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/start", { method: "POST", headers }), env);
  const secondaryResponse = await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/secondary/start", { method: "POST", headers }), env);
  const primaryUrl = new URL((await primaryResponse.json()).url);
  const secondaryUrl = new URL((await secondaryResponse.json()).url);
  assert.equal(primaryUrl.searchParams.has("auth_type"), false);
  assert.equal(secondaryUrl.searchParams.get("auth_type"), "reauthorize");
  assert.equal(primaryUrl.searchParams.has("prompt"), false);
  assert.equal(secondaryUrl.searchParams.has("prompt"), false);
  assert.match(states[0], /^oauth_state:(?!secondary\.)/);
  assert.match(states[1], /^oauth_state:secondary\./);
  assert.notEqual(primaryUrl.searchParams.get("state"), secondaryUrl.searchParams.get("state"));
});

test("secondary OAuth callback stores only selectable managed Pages and never overwrites primary", async () => {
  const originalFetch = globalThis.fetch;
  const sqlWrites = [];
  const pageToken = "P".repeat(50);
  const db = { prepare(sql) { return {
    bind(...values) {
      if (sql.includes("RETURNING created_at")) return { first: async () => ({ created_at: new Date().toISOString() }) };
      return { run: async () => { sqlWrites.push({ sql, values }); return { success: true }; } };
    }, run: async () => ({ success: true }),
  }; } };
  let call = 0;
  globalThis.fetch = async () => {
    call += 1;
    if (call === 1) return Response.json({ access_token: "short-user-token" });
    if (call === 2) return Response.json({ access_token: "long-user-token", expires_in: 5000 });
    return Response.json({ data: [{ id: "61592339597666", name: "Bingo Secondary", access_token: pageToken, tasks: ["CREATE_CONTENT"] }, { id: "personal-profile", name: "Profile", access_token: pageToken }] });
  };
  try {
    const response = await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/callback?state=secondary.valid&code=code"), { GIFT_CARD_DB: db, META_APP_ID: "app", META_APP_SECRET: "secret" });
    const location = new URL(response.headers.get("Location"));
    assert.equal(location.searchParams.get("oauth"), "secondary_select");
    assert.equal(location.searchParams.get("pages"), "1");
    assert.equal(sqlWrites.some((write) => write.sql.includes("INSERT INTO marketing_connections")), false);
    const candidate = sqlWrites.find((write) => write.sql.includes("INSERT INTO marketing_facebook_oauth_pages"));
    assert.equal(candidate.values[1], "61592339597666");
    assert.equal(candidate.values.includes("personal-profile"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("secondary OAuth fails closed when Meta returns no real Pages or only profile IDs", async () => {
  const originalFetch = globalThis.fetch;
  const writes = [];
  const db = { prepare(sql) { return {
    bind(...values) {
      if (sql.includes("RETURNING created_at")) return { first: async () => ({ created_at: new Date().toISOString() }) };
      return { run: async () => { writes.push({ sql, values }); return { success: true }; } };
    }, run: async () => ({ success: true }),
  }; } };
  let request = 0;
  globalThis.fetch = async () => {
    request += 1;
    if (request === 1) return Response.json({ access_token: "short-user-token" });
    if (request === 2) return Response.json({ access_token: "long-user-token", expires_in: 5000 });
    return Response.json({ data: [{ id: "professional-profile", name: "Not a Page", access_token: "P".repeat(50) }] });
  };
  try {
    const response = await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/callback?state=secondary.profile-only&code=code"), { GIFT_CARD_DB: db, META_APP_ID: "app", META_APP_SECRET: "secret" });
    const location = new URL(response.headers.get("Location"));
    assert.equal(location.searchParams.get("oauth"), "secondary_select");
    assert.equal(location.searchParams.get("pages"), "0");
    assert.equal(writes.some((write) => write.sql.includes("INSERT INTO marketing_facebook_connections")), false);
    assert.equal(writes.some((write) => write.sql.includes("INSERT INTO marketing_connections")), false);
    assert.equal(writes.some((write) => /instagram|tiktok/i.test(write.sql)), false);
    assert.equal(location.toString().includes("long-user-token"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("secondary selection rejects the configured primary Page without a Meta request", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; throw new Error("unexpected"); };
  try {
    const db = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
    const response = await handleMarketingRequest(new Request("https://admin.bingodogwash.com/api/admin/marketing/oauth/secondary/select", { method: "POST", headers: { Authorization: "Bearer admin", "Content-Type": "application/json" }, body: JSON.stringify({ flowId: "flow", pageId: "1264938680034651" }) }), { ADMIN_API_TOKEN: "admin", GIFT_CARD_DB: db, META_PAGE_ID: "1264938680034651" });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /Already connected as Facebook Primary/);
    assert.equal(requests, 0);
  } finally { globalThis.fetch = originalFetch; }
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

test("next marketing run advances to the next four-hour slot", () => {
  assert.equal(
    marketingTestHelpers.nextRunAt({ schedule_hour_utc: 9, schedule_minute_utc: 15 }, new Date("2026-07-31T10:00:00Z")),
    "2026-07-31T13:15:00.000Z"
  );
  assert.equal(
    marketingTestHelpers.nextRunAt({ schedule_hour_utc: 4, schedule_minute_utc: 15 }, new Date("2026-07-31T21:00:00Z")),
    "2026-08-01T00:15:00.000Z"
  );
});

test("four-hour schedule recognises each slot and creates a per-slot duplicate key", () => {
  const settings = { schedule_hour_utc: 4, schedule_minute_utc: 15 };
  for (const hour of [0, 4, 8, 12, 16, 20]) {
    const date = new Date(`2026-08-06T${String(hour).padStart(2, "0")}:15:00Z`);
    assert.equal(marketingTestHelpers.isScheduledSlot(settings, date), true);
  }
  assert.equal(marketingTestHelpers.isScheduledSlot(settings, new Date("2026-08-06T06:15:00Z")), false);
  assert.equal(marketingTestHelpers.scheduleSlotKey(settings, new Date("2026-08-06T08:19:30Z")), "2026-08-06T08:15");
});

function approvedMarketingEtsyProduct(overrides = {}) {
  const listingId = String(overrides.external_listing_id || "4440462877");
  const listingUrl = `https://www.etsy.com/listing/${listingId}/dog-product`;
  const affiliateUrl = `https://click.linksynergy.com/deeplink?id=FUdPmdlyOp8&mid=54080&murl=${encodeURIComponent(listingUrl)}`;
  return {
    source: "etsy", id: `etsy-row-${listingId}`, external_listing_id: listingId, name: "Approved dog product",
    listing_url: listingUrl, original_listing_url: listingUrl, affiliate_url: affiliateUrl,
    affiliate_verified_url: affiliateUrl, affiliate_final_url: listingUrl,
    affiliate_destination_listing_id: listingId, affiliate_review_status: "approved",
    affiliate_reviewed_at: "2026-08-19T10:00:00.000Z", affiliate_reviewed_by: "admin",
    affiliate_verification_status: "match", affiliate_verified_at: "2026-08-19T09:00:00.000Z",
    affiliate_provider: "rakuten", affiliate_program: "etsy_creator_collective_uk",
    affiliate_storefront: "Concordia Mercatura", image: "https://example.com/dog.jpg", ...overrides,
  };
}

test("marketing Etsy selection is limited to public Concordia catalogue records", async () => {
  let selectionSql = "";
  const selected = approvedMarketingEtsyProduct();
  const db = {
    prepare(sql) {
      selectionSql = sql;
      return { first: async () => selected };
    },
  };

  assert.equal((await marketingTestHelpers.selectNextProduct(db)).url, selected.affiliate_url);
  assert.match(selectionSql, /public_visibility = 1 AND admin_status = 'published'/);
  assert.match(selectionSql, /affiliate_storefront = 'Concordia Mercatura'/);
  assert.match(selectionSql, /affiliate_verification_status = 'match'/);
  assert.doesNotMatch(selectionSql, /etsy\.com\/search/i);
  assert.doesNotMatch(selectionSql, /ELSE .*storefront/i);
  assert.match(selectionSql, /marketing_posts/);
});

test("automatic selection excludes a canonical product successfully posted within seven days", async () => {
  const queries = [];
  const binds = [];
  const differentProduct = approvedMarketingEtsyProduct({ id: "etsy-row-2", name: "Different dog product" });
  const db = {
    prepare(sql) {
      queries.push(sql);
      return {
        bind(...values) { binds.push(values); return this; },
        first: async () => differentProduct,
      };
    },
  };

  const selected = await marketingTestHelpers.selectNextProduct(db, {
    respectCooldown: true,
    now: new Date("2026-08-20T12:00:00.000Z"),
  });

  assert.equal(selected.id, "etsy-row-2");
  assert.equal(selected.cooldownFallback, false);
  assert.equal(queries.length, 1);
  assert.match(queries[0], /mp\.product_id = etsy_products\.id/);
  assert.match(queries[0], /mp\.trigger_type = 'scheduled'/);
  assert.match(queries[0], /mp\.created_at > \?/);
  assert.match(queries[0], /mpr\.status = 'success'/);
  assert.match(queries[0], /mpr\.platform = 'instagram'/);
  assert.match(queries[0], /mpr\.platform LIKE 'facebook:%'/);
  assert.deepEqual(binds, [["2026-08-13T12:00:00.000Z"]]);
});

test("automatic cooldown uses canonical ID regardless of repeated title or caption", async () => {
  let selectionSql = "";
  const db = {
    prepare(sql) {
      selectionSql = sql;
      return { bind() { return this; }, first: async () => approvedMarketingEtsyProduct({ id: "different-canonical-id", name: "SMALL/MEDIUM water-resistant dog bath cap" }) };
    },
  };
  await marketingTestHelpers.selectNextProduct(db, { respectCooldown: true });
  assert.match(selectionSql, /mp\.product_id = etsy_products\.id/);
  assert.doesNotMatch(selectionSql, /product_name\s*=/);
  assert.doesNotMatch(selectionSql, /caption\s*=/);
});

test("a product becomes eligible at the seven-day cooldown boundary", async () => {
  let selectionSql = "";
  let cutoff = "";
  const db = {
    prepare(sql) {
      selectionSql = sql;
      return {
        bind(value) { cutoff = value; return this; },
        first: async () => approvedMarketingEtsyProduct({ id: "seven-day-old-product" }),
      };
    },
  };
  const selected = await marketingTestHelpers.selectNextProduct(db, {
    respectCooldown: true,
    now: new Date("2026-08-20T12:00:00.000Z"),
  });
  assert.equal(selected.id, "seven-day-old-product");
  assert.equal(cutoff, "2026-08-13T12:00:00.000Z");
  assert.match(selectionSql, /mp\.created_at > \?/);
  assert.doesNotMatch(selectionSql, /mp\.created_at >= \?/);
});

test("failed and manual posts do not count toward automatic cooldown", async () => {
  let selectionSql = "";
  const db = {
    prepare(sql) {
      selectionSql = sql;
      return { bind() { return this; }, first: async () => approvedMarketingEtsyProduct({ id: "eligible-product" }) };
    },
  };
  await marketingTestHelpers.selectNextProduct(db, { respectCooldown: true });
  assert.match(selectionSql, /mp\.status IN \('success', 'partial'\)/);
  assert.match(selectionSql, /mp\.trigger_type = 'scheduled'/);
  assert.doesNotMatch(selectionSql, /mp\.status IN \([^)]*failed/);
});

test("manual test-post selection remains outside the automatic cooldown", async () => {
  let selectionSql = "";
  let bindCalls = 0;
  const db = {
    prepare(sql) {
      selectionSql = sql;
      return {
        bind() { bindCalls += 1; return this; },
        first: async () => approvedMarketingEtsyProduct({ id: "manual-product" }),
      };
    },
  };
  const selected = await marketingTestHelpers.selectNextProduct(db, { respectCooldown: false });
  assert.equal(selected.id, "manual-product");
  assert.equal(bindCalls, 0);
  assert.doesNotMatch(selectionSql, /mp\.created_at > \?/);
});

test("all-cooling automatic products rotate to the least recent without repeating the latest", async () => {
  const queries = [];
  const results = [null, approvedMarketingEtsyProduct({ id: "least-recent-product", name: "Older eligible dog product", last_successful_at: "2026-08-19T08:00:00.000Z" })];
  const db = {
    prepare(sql) {
      queries.push(sql);
      return {
        bind() { return this; },
        first: async () => results.shift() || null,
      };
    },
  };
  const selected = await marketingTestHelpers.selectNextProduct(db, { respectCooldown: true });
  assert.equal(selected.id, "least-recent-product");
  assert.equal(selected.cooldownFallback, true);
  assert.equal(queries.length, 2);
  assert.match(queries[1], /etsy_products\.id <> COALESCE/);
  assert.match(queries[1], /ORDER BY recent\.created_at DESC LIMIT 1/);
  assert.match(queries[1], /COALESCE\(\(SELECT MAX\(mp\.created_at\)/);
});

test("automatic selection returns no product instead of consecutively reusing the only cooling product", async () => {
  const db = {
    prepare() {
      return { bind() { return this; }, first: async () => null };
    },
  };
  assert.equal(await marketingTestHelpers.selectNextProduct(db, { respectCooldown: true }), null);
});

test("Marketing Etsy affiliate validation fails closed for missing, plain, draft and mismatched evidence", () => {
  const valid = approvedMarketingEtsyProduct();
  assert.equal(marketingTestHelpers.canonicalEtsyAffiliateUrl(valid), valid.affiliate_url);
  const trackedAffiliateUrl = new URL(marketingTestHelpers.trackedDestination(
    marketingTestHelpers.campaignUrl(valid.affiliate_url, "affiliate-safe"),
  ));
  const approvedAffiliateUrl = new URL(valid.affiliate_url);
  assert.equal(trackedAffiliateUrl.origin, approvedAffiliateUrl.origin);
  assert.equal(trackedAffiliateUrl.pathname, approvedAffiliateUrl.pathname);
  for (const parameter of ["id", "mid", "murl"]) {
    assert.equal(trackedAffiliateUrl.searchParams.get(parameter), approvedAffiliateUrl.searchParams.get(parameter));
  }
  assert.equal(trackedAffiliateUrl.searchParams.get("utm_campaign"), "affiliate-safe");
  for (const product of [
    { ...valid, affiliate_url: "" },
    { ...valid, affiliate_url: valid.listing_url, affiliate_verified_url: valid.listing_url },
    { ...valid, affiliate_review_status: "draft" },
    { ...valid, affiliate_verification_status: "mismatch" },
    { ...valid, affiliate_destination_listing_id: "999999" },
  ]) assert.equal(marketingTestHelpers.canonicalEtsyAffiliateUrl(product), "");
});

test("Instagram fallback candidates use the same public Concordia eligibility rule", async () => {
  const originalFetch = globalThis.fetch;
  let selectionSql = "";
  globalThis.fetch = async () => new Response(null, { status: 404 });
  const preferred = approvedMarketingEtsyProduct({ id: "preferred", name: "Preferred", image: "https://example.com/preferred.jpg" });
  const db = {
    prepare(sql) {
      selectionSql = sql;
      return { all: async () => ({ results: [] }) };
    },
  };
  try {
    await marketingTestHelpers.selectInstagramProduct(db, preferred);
    assert.match(selectionSql, /public_visibility = 1 AND admin_status = 'published'/);
    assert.match(selectionSql, /affiliate_storefront = 'Concordia Mercatura'/);
    assert.match(selectionSql, /affiliate_verification_status = 'match'/);
    assert.doesNotMatch(selectionSql, /etsy\.com\/search/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("scheduled Instagram fallback candidates cannot bypass the product cooldown", async () => {
  const originalFetch = globalThis.fetch;
  let selectionSql = "";
  let cutoff = "";
  globalThis.fetch = async () => new Response(null, { status: 404 });
  const db = {
    prepare(sql) {
      selectionSql = sql;
      return {
        bind(value) { cutoff = value; return this; },
        all: async () => ({ results: [] }),
      };
    },
  };
  try {
    await marketingTestHelpers.selectInstagramProduct(
      db,
      approvedMarketingEtsyProduct({ id: "preferred", name: "Preferred", image: "https://example.com/preferred.jpg" }),
      { respectCooldown: true, now: new Date("2026-08-20T12:00:00.000Z") }
    );
    assert.match(selectionSql, /mp\.product_id = etsy_products\.id/);
    assert.match(selectionSql, /mp\.created_at > \?/);
    assert.equal(cutoff, "2026-08-13T12:00:00.000Z");
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("Facebook collaboration update requires admin authentication", async () => {
  const response = await handleMarketingRequest(new Request("https://bingodogwash.com/api/admin/marketing/facebook-collaboration", {
    method: "POST",
    body: JSON.stringify({ platformResultId: "result-1", state: "completed" }),
  }), { ADMIN_API_TOKEN: "secret", GIFT_CARD_DB: {} });
  assert.equal(response.status, 401);
});

test("Facebook collaboration update marks only an owned successful Primary result", async () => {
  const writes = [];
  const database = {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            first: async () => ({
              id: "result-1",
              post_id: "post-1",
              platform: "facebook:1264938680034651",
              status: "success",
              metadata: JSON.stringify({ connectionRole: "facebook_primary", pageId: "1264938680034651", pageName: "Bingo Dog Wash" }),
            }),
            run: async () => { writes.push({ sql, values }); return { success: true }; },
          };
        },
      };
    },
  };
  const originalFetch = globalThis.fetch;
  let metaRequests = 0;
  globalThis.fetch = async () => { metaRequests += 1; throw new Error("unexpected network request"); };
  try {
    const response = await handleMarketingRequest(new Request("https://bingodogwash.com/api/admin/marketing/facebook-collaboration", {
      method: "POST",
      headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
      body: JSON.stringify({ platformResultId: "result-1", state: "completed" }),
    }), { ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: database, META_PAGE_ID: "1264938680034651", META_PAGE_ACCESS_TOKEN: "must-not-appear" });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.collaborationState, "completed");
    assert.equal(JSON.stringify(body).includes("must-not-appear"), false);
    assert.equal(metaRequests, 0);
    assert.equal(writes.length, 1);
    assert.match(writes[0].sql, /marketing_facebook_collaboration_followups/);
    assert.deepEqual(writes[0].values.slice(0, 3), ["result-1", "post-1", "completed"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Facebook collaboration update supports resetting a successful Primary result to pending", async () => {
  let values = [];
  const database = { prepare: (sql) => ({ bind: (...bound) => ({
    first: async () => ({ id: "result-1", post_id: "post-1", platform: "facebook:1264938680034651", status: "success", metadata: "{}" }),
    run: async () => { values = bound; return { success: true }; },
  }) }) };
  const response = await handleMarketingRequest(new Request("https://bingodogwash.com/api/admin/marketing/facebook-collaboration", {
    method: "POST", headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
    body: JSON.stringify({ platformResultId: "result-1", state: "pending" }),
  }), { ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: database, META_PAGE_ID: "1264938680034651" });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).collaborationState, "pending");
  assert.equal(values[2], "pending");
  assert.equal(values[3], null);
});

test("Facebook collaboration update fails closed for unknown, failed, Secondary, and unconfigured Page records", async () => {
  async function requestFor(record, env = {}) {
    const database = { prepare: () => ({ bind: () => ({ first: async () => record, run: async () => assert.fail("unexpected write") }) }) };
    return handleMarketingRequest(new Request("https://bingodogwash.com/api/admin/marketing/facebook-collaboration", {
      method: "POST", headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
      body: JSON.stringify({ platformResultId: "result-1", state: "completed" }),
    }), { ADMIN_API_TOKEN: "admin-token", GIFT_CARD_DB: database, META_PAGE_ID: "1264938680034651", ...env });
  }
  assert.equal((await requestFor(null)).status, 404);
  assert.equal((await requestFor({ id: "result-1", post_id: "post-1", platform: "facebook:1264938680034651", status: "failed", metadata: "{}" })).status, 409);
  assert.equal((await requestFor({ id: "result-1", post_id: "post-1", platform: "facebook_secondary:2", status: "success", metadata: JSON.stringify({ connectionRole: "facebook_secondary", pageId: "2" }) })).status, 404);
  assert.equal((await requestFor({ id: "result-1", post_id: "post-1", platform: "facebook:999", status: "success", metadata: "{}" })).status, 404);
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
    assert.equal(result.statusMessage, "Single-Page fallback active — Facebook Page 1264938680034651");
    assert.equal(result.fallbackPageTokenUsed, true);
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
  let requestedUrl = "";
  globalThis.fetch = async (url, options) => {
    requestedUrl = String(url);
    requestedHeaders = options.headers;
    return Response.json({ id: "fb-photo-123" });
  };
  try {
    const result = await marketingTestHelpers.publishFacebook({ META_PAGE_ID: "1264938680034651" }, "https://example.com/image.jpg", "caption", "https://example.com/product", "B".repeat(50));
    assert.equal(result, "fb-photo-123");
    assert.equal(requestedHeaders.Authorization, `Bearer ${"B".repeat(50)}`);
    assert.equal(requestedUrl.includes("access_token"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("Facebook page configuration preserves the legacy ID and supports multiple de-duplicated IDs", () => {
  assert.deepEqual(marketingTestHelpers.configuredFacebookPageIds({ META_PAGE_ID: "1264938680034651" }), ["1264938680034651"]);
  assert.deepEqual(marketingTestHelpers.configuredFacebookPageIds({
    META_PAGE_ID: "1264938680034651",
    META_PAGE_IDS: "1264938680034651,61592339597666, 61590905394658",
  }), ["1264938680034651", "61592339597666", "61590905394658"]);
});

test("production configuration enables only the connected Facebook Page", () => {
  const config = JSON.parse(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(config.vars.META_PAGE_ID, "1264938680034651");
  assert.equal(config.vars.META_PAGE_IDS, "1264938680034651");
});

test("posting endpoint response reports each Facebook Page separately without token metadata", () => {
  const response = marketingTestHelpers.postingEndpointResponse({ platforms: {
    facebook: { pages: {
      "61592339597666": { ok: true, id: "facebook-post-new", tokenSource: "d1:me/accounts" },
      "61590905394658": { ok: false, error: "Page rejected the post", diagnostic: { private: true } },
    } },
    instagram: { ok: true, id: "instagram-post" },
  } }, ["61592339597666", "61590905394658"]);
  assert.deepEqual(response, {
    facebook: {
      "61592339597666": { success: true, postId: "facebook-post-new" },
      "61590905394658": { success: false, error: "Page rejected the post" },
    },
    instagram: { success: true, postId: "instagram-post" },
  });
});

test("posting endpoint response reports a credential failure against every configured Facebook Page", () => {
  const response = marketingTestHelpers.postingEndpointResponse({ platforms: {
    facebook: { ok: false, pages: {
      "61592339597666": { ok: false, error: "Meta connection expired" },
      "61590905394658": { ok: false, error: "Meta connection expired" },
    } },
    instagram: { ok: true },
  } }, ["61592339597666", "61590905394658"]);
  assert.deepEqual(response.facebook, {
    "61592339597666": { success: false, error: "Meta connection expired" },
    "61590905394658": { success: false, error: "Meta connection expired" },
  });
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

test("primary and secondary Facebook destinations retain isolated platform keys and metadata", async () => {
  const originalFetch = globalThis.fetch;
  const writes = [];
  globalThis.fetch = async (url) => String(url).includes("/secondary-page/")
    ? new Response(JSON.stringify({ error: { code: 100, message: "Secondary unavailable" } }), { status: 400 })
    : Response.json({ id: "primary-post" });
  const db = { prepare: (sql) => ({ bind: (...values) => ({ run: async () => { writes.push({ sql, values }); return { success: true }; } }) }) };
  try {
    const result = await marketingTestHelpers.publishFacebookPages({}, db, "post-id", [
      { ok: true, pageId: "primary-page", name: "Primary", token: "P".repeat(50), connectionRole: "facebook_primary" },
      { ok: true, pageId: "secondary-page", name: "Secondary", token: "S".repeat(50), connectionRole: "facebook_secondary" },
    ], { image: "https://example.com/dog.jpg" }, "caption", "https://bingodogwash.com/shop", "test");
    assert.equal(result.status, "partial");
    const platforms = writes.map((write) => write.values[2]);
    assert.equal(platforms.includes("facebook:primary-page"), true);
    assert.equal(platforms.includes("facebook_secondary:secondary-page"), true);
    const secondaryMetadata = JSON.parse(writes.find((write) => write.values[2] === "facebook_secondary:secondary-page").values[7]);
    assert.deepEqual(secondaryMetadata, { connectionRole: "facebook_secondary", pageId: "secondary-page", pageName: "Secondary" });
    assert.equal(result.pages["primary-page"].ok, true);
    assert.equal(result.pages["secondary-page"].ok, false);
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
  globalThis.fetch = async (_url, options = {}) => {
    requests += 1;
    if (options.method !== "POST") return Response.json({ id: "container-id", status_code: "FINISHED" });
    return Response.json({ id: requests === 1 ? "container-id" : "instagram-post-id" });
  };
  try {
    assert.equal(await marketingTestHelpers.publishInstagram({ META_INSTAGRAM_USER_ID: "instagram-id" }, "https://example.com/image.jpg", "caption", "I".repeat(50)), "instagram-post-id");
    assert.equal(requests, 3);
  } finally { globalThis.fetch = originalFetch; }
});

test("Instagram retries a temporarily unavailable media ID without recreating the container", async () => {
  const originalFetch = globalThis.fetch;
  let creates = 0;
  let publishes = 0;
  let statusChecks = 0;
  globalThis.fetch = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("/media")) {
      creates += 1;
      return Response.json({ id: "container-id" });
    }
    if (pathname.endsWith("/container-id")) {
      statusChecks += 1;
      return Response.json({ id: "container-id", status_code: "FINISHED" });
    }
    if (pathname.endsWith("/media_publish")) {
      publishes += 1;
      if (publishes === 1) {
        return new Response(JSON.stringify({ error: { code: 9007, type: "OAuthException", message: "Media ID is not available" } }), { status: 400 });
      }
      return Response.json({ id: "instagram-post-id" });
    }
    throw new Error(`Unexpected Instagram request: ${pathname}`);
  };
  try {
    const result = await marketingTestHelpers.publishInstagram({
      META_INSTAGRAM_USER_ID: "instagram-id",
      INSTAGRAM_MEDIA_STATUS_DELAY_MS: "0",
    }, "https://example.com/image.jpg", "caption", "I".repeat(50));
    assert.equal(result, "instagram-post-id");
    assert.equal(creates, 1);
    assert.equal(publishes, 2);
    assert.equal(statusChecks, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("Instagram waits for its media container to finish before publishing", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let statusChecks = 0;
  globalThis.fetch = async (url, options = {}) => {
    const pathname = new URL(url).pathname;
    calls.push({ pathname, method: options.method || "GET" });
    if (pathname.endsWith("/media")) return Response.json({ id: "container-id" });
    if (pathname.endsWith("/container-id")) {
      statusChecks += 1;
      return Response.json({ id: "container-id", status_code: statusChecks === 1 ? "IN_PROGRESS" : "FINISHED" });
    }
    if (pathname.endsWith("/media_publish")) return Response.json({ id: "instagram-post-id" });
    throw new Error(`Unexpected Instagram request: ${pathname}`);
  };
  try {
    const result = await marketingTestHelpers.publishInstagram({
      META_INSTAGRAM_USER_ID: "instagram-id",
      INSTAGRAM_MEDIA_STATUS_DELAY_MS: "0",
    }, "https://example.com/image.jpg", "caption", "I".repeat(50));
    assert.equal(result, "instagram-post-id");
    assert.equal(statusChecks, 2);
    assert.deepEqual(calls.map((call) => call.pathname.split("/").pop()), ["media", "container-id", "container-id", "media_publish"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("Instagram does not publish a media container that processing rejected", async () => {
  const originalFetch = globalThis.fetch;
  let publishCalled = false;
  globalThis.fetch = async (url) => {
    const pathname = new URL(url).pathname;
    if (pathname.endsWith("/media")) return Response.json({ id: "container-id" });
    if (pathname.endsWith("/container-id")) return Response.json({ id: "container-id", status_code: "ERROR" });
    if (pathname.endsWith("/media_publish")) publishCalled = true;
    return Response.json({ id: "unexpected" });
  };
  try {
    await assert.rejects(marketingTestHelpers.publishInstagram({ META_INSTAGRAM_USER_ID: "instagram-id" }, "https://example.com/image.jpg", "caption", "I".repeat(50)), /processing error/);
    assert.equal(publishCalled, false);
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
      { id: "page-1", name: "First Page", access_token: "P".repeat(50), tasks: ["CREATE_CONTENT"] },
      { id: "page-2", name: "Second Page", access_token: "Q".repeat(50), tasks: ["CREATE_CONTENT"] },
      { id: "page-3", name: "Third Page", access_token: "R".repeat(50), tasks: ["CREATE_CONTENT"] },
    ] });
    throw new Error("secret fallback must not be used");
  };
  const db = { prepare: () => ({ first: async () => ({ page_access_token: storedToken, updated_at: "2026-08-04T06:40:00Z" }) }) };
  try {
    const result = await marketingTestHelpers.resolveFacebookPublishingContext({ GIFT_CARD_DB: db, META_PAGE_ACCESS_TOKEN: secretToken, META_PAGE_IDS: "page-1,page-2,page-3" }, ["page-1", "page-2", "page-3"]);
    assert.equal(result.connection.source, "d1");
    assert.equal(result.userCredentialSource, "d1/meta_oauth");
    assert.equal(result.singlePageMode, false);
    assert.equal(result.multiPageModeAvailable, true);
    assert.equal(result.accountsRequest.ok, true);
    assert.deepEqual(result.accountsRequest.returnedPageIds, ["page-1", "page-2", "page-3"]);
    assert.deepEqual(result.accountsRequest.returnedPageNames, ["First Page", "Second Page", "Third Page"]);
    assert.equal(result.pageAccess.every((page) => page.ok), true);
    assert.equal(new Set(result.pageAccess.map((page) => page.token)).size, 3);
    assert.equal(result.pageAccess.every((page) => page.tokenSource === "d1/meta_oauth:me/accounts"), true);
  } finally { globalThis.fetch = originalFetch; }
});

test("single configured Page still prefers the stored USER credential over the legacy PAGE token", async () => {
  const originalFetch = globalThis.fetch;
  const storedToken = "D".repeat(50);
  const secretToken = "S".repeat(50);
  const calls = [];
  globalThis.fetch = async (url, options) => {
    const token = options.headers.Authorization.slice("Bearer ".length);
    calls.push({ url: String(url), token });
    if (String(url).includes("/debug_token")) return Response.json({ data: { is_valid: true, type: token === storedToken ? "USER" : "PAGE", scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"] } });
    if (String(url).includes("/me/accounts")) return Response.json({ data: [{ id: "1264938680034651", name: "Bingo Dog Wash", access_token: "P".repeat(50), tasks: ["CREATE_CONTENT"] }] });
    throw new Error("legacy Page identity must not be queried when user discovery succeeds");
  };
  const db = { prepare: () => ({ first: async () => ({ page_access_token: storedToken }) }) };
  try {
    const result = await marketingTestHelpers.facebookPreflight({ GIFT_CARD_DB: db, META_PAGE_ACCESS_TOKEN: secretToken, META_PAGE_ID: "1264938680034651" });
    assert.equal(result.ok, true);
    assert.equal(result.userCredentialSource, "d1/meta_oauth");
    assert.equal(result.accountsRequest.attempted, true);
    assert.equal(result.singlePageMode, false);
    assert.equal(result.multiPageModeAvailable, true);
    assert.equal(result.pages["1264938680034651"].name, "Bingo Dog Wash");
    assert.equal(calls.some((call) => call.url.includes("/me?") && call.token === secretToken), false);
    assert.equal(JSON.stringify(result).includes(storedToken) || JSON.stringify(result).includes(secretToken) || JSON.stringify(result).includes("P".repeat(50)), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("empty user discovery preserves the configured working Page through PAGE-token fallback", async () => {
  const originalFetch = globalThis.fetch;
  const storedToken = "D".repeat(50);
  const secretToken = "S".repeat(50);
  globalThis.fetch = async (url, options) => {
    const token = options.headers.Authorization.slice("Bearer ".length);
    if (String(url).includes("/debug_token")) return Response.json({ data: { is_valid: true, type: token === storedToken ? "USER" : "PAGE", scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"] } });
    if (String(url).includes("/me/accounts")) return Response.json({ data: [] });
    if (String(url).includes("/me?")) return Response.json({ id: "1264938680034651", name: "Legacy Working Page" });
    throw new Error("unexpected request");
  };
  const db = { prepare: () => ({ first: async () => ({ page_access_token: storedToken }) }) };
  try {
    const result = await marketingTestHelpers.facebookPreflight({ GIFT_CARD_DB: db, META_PAGE_ACCESS_TOKEN: secretToken, META_PAGE_ID: "1264938680034651" });
    assert.equal(result.ok, true);
    assert.equal(result.userCredentialSource, "d1/meta_oauth");
    assert.equal(result.accountsRequest.attempted, true);
    assert.equal(result.accountsRequest.returnedPageCount, 0);
    assert.equal(result.fallbackPageTokenUsed, true);
    assert.equal(result.pages["1264938680034651"].ok, true);
    assert.equal(result.pages["1264938680034651"].tokenSource, "secret:page_token");
    assert.equal(JSON.stringify(result).includes(storedToken) || JSON.stringify(result).includes(secretToken), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("failed user discovery falls back safely without exposing either credential", async () => {
  const originalFetch = globalThis.fetch;
  const storedToken = "D".repeat(50);
  const secretToken = "S".repeat(50);
  globalThis.fetch = async (url, options) => {
    const token = options.headers.Authorization.slice("Bearer ".length);
    if (String(url).includes("/debug_token")) return Response.json({ data: { is_valid: true, type: token === storedToken ? "USER" : "PAGE", scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"] } });
    if (String(url).includes("/me/accounts")) return Response.json({ error: { message: "Temporary discovery failure", code: 2 } }, { status: 500 });
    if (String(url).includes("/me?")) return Response.json({ id: "1264938680034651", name: "Legacy Working Page" });
    throw new Error("unexpected request");
  };
  const db = { prepare: () => ({ first: async () => ({ page_access_token: storedToken }) }) };
  try {
    const result = await marketingTestHelpers.facebookPreflight({ GIFT_CARD_DB: db, META_PAGE_ACCESS_TOKEN: secretToken, META_PAGE_ID: "1264938680034651" });
    assert.equal(result.ok, true);
    assert.equal(result.accountsRequest.ok, false);
    assert.equal(result.accountsRequest.attempted, true);
    assert.equal(result.fallbackPageTokenUsed, true);
    assert.equal(result.pages["1264938680034651"].ok, true);
    assert.equal(JSON.stringify(result).includes(storedToken) || JSON.stringify(result).includes(secretToken), false);
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

test("Instagram feed captions use link in bio and never pretend caption URLs are clickable", () => {
  const caption = marketingTestHelpers.instagramFeedCaption("Lovely dog shampoo. Click the link below! https://bingodogwash.com/product?id=1");
  assert.equal(caption.includes("http"), false);
  assert.doesNotMatch(caption, /click the link below/i);
  assert.match(caption, /Shop now — link in bio 🐾$/);
});

test("Instagram image validation rejects local, forbidden, missing, timed-out and non-image resources", async () => {
  assert.match((await marketingTestHelpers.validateInstagramImage("blob:https://bingodogwash.com/id")).reason, /HTTP/);
  assert.match((await marketingTestHelpers.validateInstagramImage("http://localhost/photo.jpg")).reason, /Local/);
  assert.match((await marketingTestHelpers.validateInstagramImage("https://example.com/photo.webp")).reason, /Unsupported/);
  const originalFetch = globalThis.fetch;
  try {
    for (const status of [403, 404]) {
      globalThis.fetch = async () => new Response(null, { status });
      assert.match((await marketingTestHelpers.validateInstagramImage("https://example.com/photo.jpg")).reason, new RegExp(String(status)));
    }
    globalThis.fetch = async () => { throw new DOMException("Timed out", "TimeoutError"); };
    assert.match((await marketingTestHelpers.validateInstagramImage("https://example.com/photo.jpg")).reason, /publicly accessible/);
    globalThis.fetch = async () => new Response("not an image", { status: 200, headers: { "Content-Type": "text/html" } });
    assert.match((await marketingTestHelpers.validateInstagramImage("https://example.com/photo.jpg")).reason, /Unsupported Content-Type/);
    globalThis.fetch = async () => new Response(null, { status: 200, headers: { "Content-Type": "image/gif" } });
    assert.match((await marketingTestHelpers.validateInstagramImage("https://example.com/photo.gif.jpg")).reason, /Unsupported Content-Type/);
  } finally { globalThis.fetch = originalFetch; }
});

test("Instagram product selection skips unique failed products and records the successful fallback", async () => {
  const preferred = { id: "first", name: "First", image: "https://example.com/first.jpg" };
  const rows = [
    approvedMarketingEtsyProduct({ id: "first", name: "Duplicate first", image: "https://example.com/first.jpg" }),
    approvedMarketingEtsyProduct({ id: "second", name: "Second", image: "https://example.com/second.jpg" }),
    approvedMarketingEtsyProduct({ id: "third", name: "Third", image: "https://example.com/third.png" }),
  ];
  const db = { prepare: () => ({ all: async () => ({ results: rows }) }) };
  const originalFetch = globalThis.fetch;
  const checked = [];
  globalThis.fetch = async (url) => {
    checked.push(String(url));
    if (String(url).includes("third.png")) return new Response(null, { status: 200, headers: { "Content-Type": "image/png" } });
    return new Response(null, { status: 404 });
  };
  try {
    const selection = await marketingTestHelpers.selectInstagramProduct(db, preferred);
    assert.equal(selection.product.id, "third");
    assert.deepEqual(selection.rejections.map((item) => item.productId), ["first", "second"]);
    assert.equal(checked.filter((url) => url.includes("first.jpg")).length, 2);
    assert.equal(checked.filter((url) => url.includes("second.jpg")).length, 2);
    assert.equal(checked.filter((url) => url.includes("third.png")).length, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test("Instagram product selection terminates when every unique product image fails", async () => {
  const preferred = { id: "first", name: "First", image: "https://example.com/first.jpg" };
  const rows = Array.from({ length: 5 }, (_, index) => approvedMarketingEtsyProduct({ id: `fallback-${index}`, name: `Fallback ${index}`, image: `https://example.com/${index}.jpg` }));
  const db = { prepare: () => ({ all: async () => ({ results: rows }) }) };
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; return new Response(null, { status: 404 }); };
  try {
    const selection = await marketingTestHelpers.selectInstagramProduct(db, preferred);
    assert.equal(selection.product, null);
    assert.equal(selection.rejections.length, 6);
    assert.equal(requests, 12);
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
      if (requests === 1) return Response.json({ id: "container-id" });
      if (requests === 2) return Response.json({ id: "container-id", status_code: "FINISHED" });
      return new Response(JSON.stringify({ error: { code: 10, error_subcode: 2207001, message: "private provider message" } }), { status: 403 });
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
  assert.deepEqual(await response.json(), { ok: false, skipped: "no-affiliate-eligible-product", error: "No affiliate-eligible product available." });
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
  const product = approvedMarketingEtsyProduct({ id: "p1", name: "Dog Shampoo", description: "gentle cleaning", price: 999, currency: "GBP", category: "Grooming", stock: 2, image: "https://bingodogwash.com/shampoo.jpg" });
  const db = { prepare(sql) { return { first: async () => sql.includes("marketing_settings") ? { enabled: 1, schedule_hour_utc: 9, schedule_minute_utc: 0 } : product, bind: () => ({ run: async () => ({ success: true }) }) }; } };
  try {
    const result = await runMarketingAutomation({ GIFT_CARD_DB: db, META_PAGE_ID: "1264938680034651", META_PAGE_ACCESS_TOKEN: "F".repeat(50), META_INSTAGRAM_USER_ID: "27879594505014566", INSTAGRAM_ACCESS_TOKEN: "I".repeat(50) }, { trigger: "test" });
    assert.equal(result.status, "partial"); assert.equal(result.platforms.facebook.ok, true); assert.equal(result.platforms.instagram.ok, false); assert.equal(result.platforms.instagram.attempts, 1);
    assert.equal(urls.some((url) => url.includes("graph.facebook.com/v25.0/1264938680034651/photos")), true);
    assert.equal(urls.some((url) => url.includes("graph.instagram.com/v26.0/27879594505014566/media")), true);
  } finally { globalThis.fetch = originalFetch; }
});

test("Facebook publishing remains successful when every Instagram image candidate is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value === "https://bingodogwash.com/broken.jpg") return new Response(null, { status: 404 });
    if (value.includes("/debug_token")) return Response.json({ data: { is_valid: true, type: "USER", scopes: ["pages_manage_posts", "pages_read_engagement", "pages_show_list"] } });
    if (value.includes("/me/accounts")) return Response.json({ data: [{ id: "page-id", access_token: "P".repeat(50) }] });
    if (value.includes("graph.instagram.com/v26.0/me")) return Response.json({ id: "instagram-id", username: "bingo", account_type: "BUSINESS" });
    if (value.includes("graph.facebook.com")) return Response.json({ id: "facebook-post-id" });
    throw new Error(`Unexpected request: ${value}`);
  };
  const product = approvedMarketingEtsyProduct({ id: "broken-product", name: "Broken image product", description: "Product description", price: 999, currency: "GBP", category: "Grooming", stock: 2, image: "https://bingodogwash.com/broken.jpg" });
  const db = { prepare(sql) { return {
    first: async () => sql.includes("marketing_settings") ? { enabled: 1, schedule_hour_utc: 9, schedule_minute_utc: 0 } : product,
    all: async () => ({ results: [] }),
    bind: () => ({ run: async () => ({ success: true }) }),
  }; } };
  try {
    const result = await runMarketingAutomation({
      GIFT_CARD_DB: db,
      META_PAGE_ID: "page-id",
      META_PAGE_ACCESS_TOKEN: "F".repeat(50),
      META_INSTAGRAM_USER_ID: "instagram-id",
      META_INSTAGRAM_USERNAME: "bingo",
      INSTAGRAM_ACCESS_TOKEN: "I".repeat(50),
    }, { trigger: "test" });
    assert.equal(result.status, "partial");
    assert.equal(result.platforms.facebook.ok, true);
    assert.equal(result.platforms.instagram.ok, false);
    assert.equal(result.platforms.instagram.skipped, true);
    assert.equal(result.platforms.instagram.rejections[0].productId, "broken-product");
  } finally { globalThis.fetch = originalFetch; }
});
