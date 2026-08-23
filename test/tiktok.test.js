import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleTikTokRequest, isTikTokPath, tiktokTestHelpers } from "../_functions_NOT_FOR_STATIC_UPLOAD/api/tiktok.js";

function oauthDb(options = {}) {
  const saved = [];
  let state = Object.prototype.hasOwnProperty.call(options, "state") ? options.state : { created_at: new Date().toISOString() };
  let connectionRead = 0;
  return {
    saved,
    prepare(sql) {
      return {
        bind(...values) {
          if (sql.includes("INSERT OR REPLACE INTO marketing_one_time_guards")) return { run: async () => { saved.push({ sql, values }); return { success: true }; } };
          if (sql.includes("DELETE FROM marketing_one_time_guards")) return { first: async () => { if (options.stateSequence) return options.stateSequence.shift() || null; const value = state; state = null; return value; } };
          if (sql.includes("INSERT INTO tiktok_connections")) return { run: async () => { saved.push({ sql, values }); return { success: true }; } };
          if (sql.includes("UPDATE tiktok_connections") && sql.includes("display_name")) return { run: async () => { saved.push({ sql, values }); return { success: true }; } };
          if (sql.includes("INSERT INTO marketing_posts") || sql.includes("INSERT INTO marketing_platform_results")) return { run: async () => { saved.push({ sql, values }); return { success: true }; } };
          if (sql.includes("FROM tiktok_connections")) return { first: async () => options.connectionSequence ? options.connectionSequence[Math.min(connectionRead++, options.connectionSequence.length - 1)] : options.connections?.[values[0]] || options.connection || null };
          return { first: async () => null, run: async () => ({ success: true }) };
        },
        all: async () => ({ results: options.connection ? [{ account_role: "marketing", ...options.connection }] : Object.entries(options.connections || {}).map(([account_role, connection]) => ({ account_role, ...connection })) }),
        first: async () => options.connectionSequence ? options.connectionSequence[Math.min(connectionRead++, options.connectionSequence.length - 1)] : options.connection || null,
      };
    },
  };
}

const configuredEnv = (db) => ({
  ADMIN_API_TOKEN: "admin-token",
  GIFT_CARD_DB: db,
  TIKTOK_CLIENT_KEY: "client-key",
  TIKTOK_CLIENT_SECRET: "client-secret",
  TIKTOK_REDIRECT_URI: "https://bingodogwash.com/api/tiktok/callback",
});

test("TikTok routes are isolated from existing marketing routes", () => {
  assert.equal(isTikTokPath("/api/tiktok/connect"), true);
  assert.equal(isTikTokPath("/api/tiktok/callback"), true);
  assert.equal(isTikTokPath("/api/tiktok/status"), true);
  assert.equal(isTikTokPath("/api/tiktok/refresh"), true);
  assert.equal(isTikTokPath("/api/tiktok/draft"), true);
  assert.equal(isTikTokPath("/api/tiktok/direct-post"), true);
  assert.equal(isTikTokPath("/api/admin/marketing"), false);
  assert.equal(isTikTokPath("/api/checkout"), false);
});

test("TikTok connect is admin protected and creates a state-bound authorization URL", async () => {
  const db = oauthDb();
  const unauthorized = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/connect"), configuredEnv(db));
  assert.equal(unauthorized.status, 401);
  const response = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/connect", {
    headers: { Authorization: "Bearer admin-token" },
  }), configuredEnv(db));
  const body = await response.json();
  const authorize = new URL(body.url);
  assert.equal(response.status, 200);
  assert.equal(authorize.origin, "https://www.tiktok.com");
  assert.equal(authorize.pathname, "/v2/auth/authorize/");
  assert.equal(authorize.searchParams.get("client_key"), "client-key");
  assert.equal(authorize.searchParams.get("redirect_uri"), "https://bingodogwash.com/api/tiktok/callback");
  assert.deepEqual(authorize.searchParams.get("scope").split(","), ["user.info.basic", "video.upload"]);
  assert.match(authorize.searchParams.get("state"), /^creator\.[a-f0-9]{64}$/);
  assert.match(db.saved[0].values[0], /^tiktok_oauth_state:creator:/);
  assert.equal(JSON.stringify(body).includes("client-secret"), false);
});

test("TikTok Direct Post scope is requested only when explicitly enabled", () => {
  assert.deepEqual(tiktokTestHelpers.requestedScopes({}), ["user.info.basic", "video.upload"]);
  assert.deepEqual(tiktokTestHelpers.requestedScopes({ TIKTOK_DIRECT_POST_ENABLED: "true" }), ["user.info.basic", "video.upload", "video.publish"]);
});

test("TikTok Sandbox credentials are selected without replacing Production credentials", async () => {
  const env = {
    ...configuredEnv(oauthDb()),
    TIKTOK_OAUTH_ENVIRONMENT: "sandbox",
    TIKTOK_SANDBOX_CLIENT_KEY: "sandbox-client-key",
    TIKTOK_SANDBOX_CLIENT_SECRET: "sandbox-client-secret",
  };
  const selected = tiktokTestHelpers.credentials(env);
  assert.equal(selected.environment, "sandbox");
  assert.equal(selected.clientKey, "sandbox-client-key");
  assert.equal(selected.clientSecret, "sandbox-client-secret");
  assert.equal(env.TIKTOK_CLIENT_KEY, "client-key");
  assert.equal(env.TIKTOK_CLIENT_SECRET, "client-secret");

  const response = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/connect", {
    headers: { Authorization: "Bearer admin-token" },
  }), env);
  const body = await response.json();
  const authorize = new URL(body.url);
  assert.equal(authorize.searchParams.get("client_key"), "sandbox-client-key");
  assert.equal(authorize.searchParams.get("redirect_uri"), "https://bingodogwash.com/api/tiktok/callback");
  assert.equal(authorize.searchParams.get("scope"), "user.info.basic,video.upload");
  assert.equal(JSON.stringify(body).includes("sandbox-client-secret"), false);
});

test("TikTok Production credentials remain the default", () => {
  const selected = tiktokTestHelpers.credentials(configuredEnv(oauthDb()));
  assert.equal(selected.environment, "production");
  assert.equal(selected.clientKey, "client-key");
  assert.equal(selected.clientSecret, "client-secret");
});

test("TikTok callback exchanges the code and stores tokens only in D1", async () => {
  const originalFetch = globalThis.fetch;
  const db = oauthDb();
  const exchanges = [];
  globalThis.fetch = async (url, options) => {
    exchanges.push({ url: String(url), options });
    if (String(url).includes("/user/info/")) return Response.json({ data: { user: { open_id: "open-id", display_name: "Bingo Creator" } }, error: { code: "ok" } });
    return Response.json({
      access_token: "access-token-private",
      refresh_token: "refresh-token-private",
      open_id: "open-id",
      scope: "user.info.basic,video.upload",
      token_type: "Bearer",
      expires_in: 86400,
      refresh_expires_in: 31536000,
    });
  };
  try {
    const response = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/callback?state=valid&code=one-time-code"), configuredEnv(db));
    assert.equal(response.status, 302);
    assert.equal(new URL(response.headers.get("Location")).searchParams.get("tiktok"), "success");
    assert.equal(exchanges[0].url, "https://open.tiktokapis.com/v2/oauth/token/");
    const form = new URLSearchParams(exchanges[0].options.body);
    assert.equal(form.get("code"), "one-time-code");
    assert.equal(form.get("client_secret"), "client-secret");
    const tokenWrite = db.saved.find((entry) => entry.sql.includes("INSERT INTO tiktok_connections"));
    assert.ok(tokenWrite);
    assert.equal(tokenWrite.values.includes("access-token-private"), true);
    assert.equal(response.headers.get("Location").includes("access-token-private"), false);
    assert.equal(response.headers.get("Location").includes("one-time-code"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Creator and Marketing connections coexist and Marketing OAuth cannot overwrite Creator", async () => {
  const originalFetch = globalThis.fetch;
  const db = oauthDb();
  globalThis.fetch = async (url) => String(url).includes("/user/info/")
    ? Response.json({ data: { user: { open_id: "marketing-open-id", display_name: "Bingo Marketing" } }, error: { code: "ok" } })
    : Response.json({ access_token: "marketing-access", refresh_token: "marketing-refresh", open_id: "marketing-open-id", scope: "user.info.basic,video.upload", expires_in: 86400, refresh_expires_in: 31536000 });
  try {
    const response = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/callback?state=marketing.valid&code=code"), configuredEnv(db));
    assert.equal(response.status, 302);
    const write = db.saved.find((entry) => entry.sql.includes("INSERT INTO tiktok_connections"));
    assert.equal(write.values[0], "marketing");
    assert.equal(write.values[1], "marketing");
    assert.equal(write.sql.includes("ON CONFLICT(id)"), true);
    assert.equal(write.values.includes("creator"), false);
    assert.equal(new URL(response.headers.get("Location")).searchParams.get("tiktokRole"), "marketing");
  } finally { globalThis.fetch = originalFetch; }
});

test("status reports Creator and Marketing identities independently", async () => {
  const future = new Date(Date.now() + 60000).toISOString();
  const db = oauthDb({ connections: {
    creator: { status: "Connected", access_token: "creator-secret", access_token_expires_at: future, scopes: "video.upload", display_name: "Creator Dog" },
    marketing: { status: "Connected", access_token: "marketing-secret", access_token_expires_at: future, scopes: "video.upload", display_name: "Marketing Dog" },
  } });
  const response = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/status", { headers: { Authorization: "Bearer admin-token" } }), configuredEnv(db));
  const body = await response.json();
  assert.equal(body.tiktok.accounts.creator.displayName, "Creator Dog");
  assert.equal(body.tiktok.accounts.marketing.displayName, "Marketing Dog");
  assert.equal(body.tiktok.accounts.creator.connected, true);
  assert.equal(body.tiktok.accounts.marketing.connected, true);
  assert.equal(JSON.stringify(body).includes("creator-secret"), false);
});

test("status reports expired Creator and Marketing access without refreshing or losing stored connections", async () => {
  const originalFetch=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests+=1;throw new Error("status must not refresh");};
  const expired=new Date(Date.now()-60000).toISOString();
  const db=oauthDb({connections:{
    creator:{status:"Connected",access_token:"creator-secret",refresh_token:"creator-refresh",access_token_expires_at:expired,scopes:"video.upload"},
    marketing:{status:"Connected",access_token:"marketing-secret",refresh_token:"marketing-refresh",access_token_expires_at:expired,scopes:"video.upload,video.publish"},
  }});
  try{
    const response=await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/status",{headers:{Authorization:"Bearer admin-token"}}),{...configuredEnv(db),TIKTOK_DIRECT_POST_ENABLED:"true"});
    const body=await response.json();
    for(const role of ["creator","marketing"]){const account=body.tiktok.accounts[role];assert.equal(account.connected,false);assert.equal(account.accessTokenExpired,true);assert.equal(account.storedConnectionRetained,true);assert.equal(account.refreshTokenPresent,true);}
    assert.equal(body.tiktok.directPostEnabled,true);assert.equal(body.tiktok.directPostReady,false);assert.equal(requests,0);assert.equal(db.saved.length,0);assert.equal(JSON.stringify(body).includes("creator-secret"),false);assert.equal(JSON.stringify(body).includes("marketing-refresh"),false);
  }finally{globalThis.fetch=originalFetch;}
});

test("status never rewrites a missing Creator identity outside explicit OAuth", async () => {
  const originalFetch = globalThis.fetch;
  const future = new Date(Date.now() + 60000).toISOString();
  const db = oauthDb({ connections: {
    creator: { status: "Connected", open_id: "creator-open-id", access_token: "creator-secret", access_token_expires_at: future, scopes: "video.upload,user.info.basic", display_name: "", username: "" },
    marketing: { status: "Connected", open_id: "marketing-open-id", access_token: "marketing-secret", access_token_expires_at: future, scopes: "user.info.basic,video.upload", display_name: "bingo_wash", username: "" },
  } });
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; throw new Error("unexpected"); };
  try {
    const response = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/status", { headers: { Authorization: "Bearer admin-token" } }), configuredEnv(db));
    const body = await response.json();
    assert.equal(body.tiktok.accounts.creator.displayName, "");
    assert.equal(body.tiktok.accounts.marketing.displayName, "bingo_wash");
    assert.deepEqual(body.tiktok.accounts.creator.scopesAvailable, ["video.upload", "user.info.basic"]);
    assert.equal(body.tiktok.directPostEnabled, false);
    assert.equal(requests, 0);
    assert.equal(db.saved.some((entry) => entry.sql.includes("UPDATE tiktok_connections")), false);
    assert.equal(JSON.stringify(body).includes("creator-secret"), false);
    assert.equal(JSON.stringify(body).includes("marketing-secret"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("Creator OAuth stores returned identity and cannot overwrite Marketing", async () => {
  const originalFetch = globalThis.fetch;
  const db = oauthDb();
  globalThis.fetch = async (url) => String(url).includes("/user/info/")
    ? Response.json({ data: { user: { open_id: "creator-open-id", display_name: "Creator From TikTok" } }, error: { code: "ok" } })
    : Response.json({ access_token: "creator-access", refresh_token: "creator-refresh", open_id: "creator-open-id", scope: "video.upload,user.info.basic", expires_in: 86400, refresh_expires_in: 31536000 });
  try {
    const response = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/callback?state=creator.valid&code=code"), configuredEnv(db));
    assert.equal(new URL(response.headers.get("Location")).searchParams.get("tiktok"), "success");
    const write = db.saved.find((entry) => entry.sql.includes("INSERT INTO tiktok_connections"));
    assert.equal(write.values[0], "creator");
    assert.equal(write.values[1], "creator");
    assert.equal(write.values.includes("creator-open-id"), true);
    assert.equal(write.values.includes("Creator From TikTok"), true);
    assert.equal(write.values.includes("marketing"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("Creator OAuth rejects mismatched user-info without replacing existing credentials", async () => {
  const originalFetch = globalThis.fetch;
  const db = oauthDb();
  globalThis.fetch = async (url) => String(url).includes("/user/info/")
    ? Response.json({ data: { user: { open_id: "different-open-id", display_name: "Different Account" } }, error: { code: "ok" } })
    : Response.json({ access_token: "new-creator-access", refresh_token: "new-creator-refresh", open_id: "expected-creator-open-id", scope: "user.info.basic,video.upload", expires_in: 86400, refresh_expires_in: 31536000 });
  try {
    const response = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/callback?state=creator.valid&code=code"), configuredEnv(db));
    const location = new URL(response.headers.get("Location"));
    assert.equal(location.searchParams.get("tiktok"), "identity_verification_failed");
    assert.equal(location.searchParams.get("tiktokRole"), "creator");
    assert.equal(db.saved.some((entry) => entry.sql.includes("INSERT INTO tiktok_connections")), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("Creator and Marketing OAuth writes retain distinct returned open_id values", async () => {
  const originalFetch = globalThis.fetch;
  const db = oauthDb({ stateSequence: [{ created_at: new Date().toISOString() }, { created_at: new Date().toISOString() }] });
  let role = "creator";
  globalThis.fetch = async (url) => {
    if (String(url).includes("/user/info/")) return Response.json({ data: { user: { open_id: `${role}-open-id`, display_name: `${role} identity` } }, error: { code: "ok" } });
    return Response.json({ access_token: `${role}-access`, refresh_token: `${role}-refresh`, open_id: `${role}-open-id`, scope: "user.info.basic,video.upload", expires_in: 86400, refresh_expires_in: 31536000 });
  };
  try {
    await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/callback?state=creator.valid&code=creator-code"), configuredEnv(db));
    role = "marketing";
    await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/callback?state=marketing.valid&code=marketing-code"), configuredEnv(db));
    const writes = db.saved.filter((entry) => entry.sql.includes("INSERT INTO tiktok_connections"));
    assert.equal(writes.length, 2);
    assert.deepEqual(writes.map((entry) => [entry.values[0], entry.values[2]]), [["creator", "creator-open-id"], ["marketing", "marketing-open-id"]]);
  } finally { globalThis.fetch = originalFetch; }
});

test("TikTok callback rejects invalid or missing state before token exchange", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; throw new Error("unexpected"); };
  try {
    for (const url of [
      "https://bingodogwash.com/api/tiktok/callback?code=code",
      "https://bingodogwash.com/api/tiktok/callback?state=invalid&code=code",
    ]) {
      const response = await handleTikTokRequest(new Request(url), configuredEnv(oauthDb({ state: null })));
      assert.equal(new URL(response.headers.get("Location")).searchParams.get("tiktok"), "invalid_state");
    }
    assert.equal(requests, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("TikTok callback reports missing code after consuming valid state", async () => {
  const response = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/callback?state=valid"), configuredEnv(oauthDb()));
  assert.equal(response.status, 302);
  assert.equal(new URL(response.headers.get("Location")).searchParams.get("tiktok"), "missing_code");
});

test("TikTok token exchange failures are controlled and do not expose secrets", async () => {
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const logs = [];
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "invalid_grant", error_description: "code private-code rejected" }), { status: 400 });
  console.error = (...values) => logs.push(values.join(" "));
  try {
    const response = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/callback?state=valid&code=private-code"), configuredEnv(oauthDb()));
    assert.equal(new URL(response.headers.get("Location")).searchParams.get("tiktok"), "token_exchange_failed");
    const exposed = `${response.headers.get("Location")} ${logs.join(" ")}`;
    assert.equal(exposed.includes("private-code"), false);
    assert.equal(exposed.includes("client-secret"), false);
    assert.equal(exposed.includes("invalid_grant"), false);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
  }
});

test("TikTok status reports safe configuration, connection and scope fields without tokens", async () => {
  const db = oauthDb({ connection: {
    status: "Connected",
    open_id: "open-id",
    access_token: "access-token-private",
    access_token_expires_at: new Date(Date.now() + 60000).toISOString(),
    scopes: "user.info.basic,video.upload",
    updated_at: "2026-08-09T00:00:00.000Z",
  } });
  const response = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/status", {
    headers: { "X-Admin-Token": "admin-token" },
  }), configuredEnv(db));
  const body = await response.json();
  assert.deepEqual(body.tiktok.scopesAvailable, ["user.info.basic", "video.upload"]);
  assert.equal(body.tiktok.configured, true);
  assert.equal(body.tiktok.connected, true);
  assert.equal(body.tiktok.tokenPresent, true);
  assert.equal(JSON.stringify(body).includes("access-token-private"), false);
  assert.equal(JSON.stringify(body).includes("client-secret"), false);
});

test("TikTok refresh exchanges the stored refresh token and rotates credentials without exposing them", async () => {
  const originalFetch = globalThis.fetch;
  const db = oauthDb({ connection: { refresh_token: "old-refresh-private", refresh_token_expires_at: new Date(Date.now() + 60000).toISOString() } });
  let form;
  globalThis.fetch = async (_url, options) => {
    if (String(_url).includes("/user/info/")) return Response.json({ data: { user: {} }, error: { code: "ok" } });
    form = new URLSearchParams(options.body);
    return Response.json({ access_token: "new-access-private", refresh_token: "new-refresh-private", open_id: "open-id", scope: "user.info.basic,video.upload", expires_in: 86400, refresh_expires_in: 31536000 });
  };
  try {
    const response = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/refresh", { method: "POST", headers: { Authorization: "Bearer admin-token" } }), configuredEnv(db));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(form.get("grant_type"), "refresh_token");
    assert.equal(form.get("refresh_token"), "old-refresh-private");
    assert.equal(body.refreshed, true);
    assert.equal(JSON.stringify(body).includes("new-access-private"), false);
    assert.equal(JSON.stringify(body).includes("new-refresh-private"), false);
    assert.ok(db.saved.some((entry) => entry.sql.includes("INSERT INTO tiktok_connections") && entry.values.includes("new-access-private")));
  } finally { globalThis.fetch = originalFetch; }
});

test("Marketing token refresh updates only the Marketing connection", async () => {
  const originalFetch = globalThis.fetch;
  const db = oauthDb({ connections: { marketing: { refresh_token: "marketing-old", refresh_token_expires_at: new Date(Date.now() + 60000).toISOString() } } });
  globalThis.fetch = async () => Response.json({ access_token: "marketing-new", refresh_token: "marketing-rotated", open_id: "marketing-open", scope: "video.upload", expires_in: 86400, refresh_expires_in: 31536000 });
  try {
    const response = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/refresh?accountRole=marketing", { method: "POST", headers: { Authorization: "Bearer admin-token" } }), configuredEnv(db));
    assert.equal(response.status, 200);
    const write = db.saved.find((entry) => entry.sql.includes("INSERT INTO tiktok_connections"));
    assert.equal(write.values[0], "marketing");
    assert.equal(write.values.includes("marketing-new"), true);
    assert.equal(write.values.includes("creator"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("AI distribution requires Marketing while Creator draft test remains on Creator", async () => {
  const creatorOnly = oauthDb({ connections: { creator: { status: "Connected", access_token: "creator-token", access_token_expires_at: new Date(Date.now() + 60000).toISOString(), scopes: "video.upload" } } });
  const aiRequest = new Request("https://bingodogwash.com/api/tiktok/draft?filename=clip.mp4&context=ai-distribution", { method: "POST", headers: { Authorization: "Bearer admin-token", "Content-Type": "video/mp4", "Content-Length": "3" }, body: new Uint8Array([1, 2, 3]) });
  const aiResponse = await handleTikTokRequest(aiRequest, configuredEnv(creatorOnly));
  assert.equal(aiResponse.status, 409);
  assert.match((await aiResponse.json()).error, /Marketing account/);

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url: String(url), options }); return calls.length === 1 ? Response.json({ data: { publish_id: "creator-draft", upload_url: "https://open-upload.tiktokapis.com/video/creator" }, error: { code: "ok" } }) : new Response(null, { status: 201 }); };
  try {
    const creatorResponse = await handleTikTokRequest(draftRequest(), configuredEnv(creatorOnly));
    assert.equal(creatorResponse.status, 200);
    assert.equal(calls[0].options.headers.Authorization, "Bearer creator-token");
    assert.equal((await creatorResponse.json()).accountRole, "creator");
  } finally { globalThis.fetch = originalFetch; }
});

function draftRequest(fileName = "test.mp4", type = "video/mp4", bytes = new Uint8Array([1, 2, 3])) {
  return new Request(`https://bingodogwash.com/api/tiktok/draft?filename=${encodeURIComponent(fileName)}`, {
    method: "POST",
    headers: { Authorization: "Bearer admin-token", "Content-Type": type, "Content-Length": String(bytes.byteLength) },
    body: bytes,
  });
}

function directRequest(params = "filename=direct.mp4&confirmed=true&privacyLevel=SELF_ONLY&title=Dog%20wash") {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  return new Request(`https://bingodogwash.com/api/tiktok/direct-post?${params}`, { method: "POST", headers: { Authorization: "Bearer admin-token", "Content-Type": "video/mp4", "Content-Length": String(bytes.byteLength) }, body: bytes });
}

test("Direct Post is disabled by default before connection or TikTok API access", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("unexpected"); };
  try {
    const response = await handleTikTokRequest(directRequest(), configuredEnv(oauthDb()));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).directPostEnabled, false);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("enabled Direct Post selects Marketing, requires video.publish and uses creator options", async () => {
  const originalFetch = globalThis.fetch;
  const future = new Date(Date.now() + 60000).toISOString();
  const db = oauthDb({ connections: {
    creator: { status: "Connected", access_token: "creator-token", access_token_expires_at: future, scopes: "video.upload,video.publish" },
    marketing: { status: "Connected", access_token: "marketing-token", access_token_expires_at: future, scopes: "video.upload,video.publish" },
  } });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return Response.json({ data: { creator_username: "bingo_wash", privacy_level_options: ["SELF_ONLY", "PUBLIC_TO_EVERYONE"], comment_disabled: false, duet_disabled: true, stitch_disabled: false }, error: { code: "ok" } });
    if (calls.length === 2) return Response.json({ data: { publish_id: "direct-publish-id", upload_url: "https://open-upload.tiktokapis.com/video/direct" }, error: { code: "ok" } });
    return new Response(null, { status: 201 });
  };
  try {
    const response = await handleTikTokRequest(directRequest(), { ...configuredEnv(db), TIKTOK_DIRECT_POST_ENABLED: "true" });
    const body = await response.json();
    assert.equal(response.status, 202);
    assert.equal(body.accountRole, "marketing");
    assert.equal(body.publishId, "direct-publish-id");
    assert.equal(calls[0].url, "https://open.tiktokapis.com/v2/post/publish/creator_info/query/");
    assert.equal(calls[0].options.headers.Authorization, "Bearer marketing-token");
    assert.equal(calls[1].url, "https://open.tiktokapis.com/v2/post/publish/video/init/");
    const init = JSON.parse(calls[1].options.body);
    assert.equal(init.post_info.privacy_level, "SELF_ONLY");
    assert.equal(init.post_info.disable_duet, true);
    assert.equal(init.post_info.brand_organic_toggle, true);
    assert.equal(JSON.stringify(calls).includes("creator-token"), false);
    assert.ok(db.saved.some((entry) => entry.values.includes('{"accountRole":"marketing","mode":"direct-post"}')));
  } finally { globalThis.fetch = originalFetch; }
});

test("Direct Post never falls back to Creator and rejects missing Marketing publish scope", async () => {
  const future = new Date(Date.now() + 60000).toISOString();
  const creatorOnly = oauthDb({ connections: { creator: { status: "Connected", access_token: "creator-token", access_token_expires_at: future, scopes: "video.publish" } } });
  const disconnected = await handleTikTokRequest(directRequest(), { ...configuredEnv(creatorOnly), TIKTOK_DIRECT_POST_ENABLED: "true" });
  assert.equal(disconnected.status, 409);
  assert.match((await disconnected.json()).error, /Marketing account/);

  const noScope = oauthDb({ connections: { marketing: { status: "Connected", access_token: "marketing-token", access_token_expires_at: future, scopes: "video.upload" } } });
  const scoped = await handleTikTokRequest(directRequest(), { ...configuredEnv(noScope), TIKTOK_DIRECT_POST_ENABLED: "true" });
  assert.equal(scoped.status, 403);
  assert.match((await scoped.json()).error, /video\.publish/);
});

test("Direct Post validates explicit confirmation and current privacy options", async () => {
  const future = new Date(Date.now() + 60000).toISOString();
  const db = oauthDb({ connections: { marketing: { status: "Connected", access_token: "marketing-token", access_token_expires_at: future, scopes: "video.upload,video.publish" } } });
  const unconfirmed = await handleTikTokRequest(directRequest("filename=direct.mp4&privacyLevel=SELF_ONLY"), { ...configuredEnv(db), TIKTOK_DIRECT_POST_ENABLED: "true" });
  assert.equal(unconfirmed.status, 400);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: { privacy_level_options: ["SELF_ONLY"] }, error: { code: "ok" } });
  try {
    const unavailable = await handleTikTokRequest(directRequest("filename=direct.mp4&confirmed=true&privacyLevel=PUBLIC_TO_EVERYONE"), { ...configuredEnv(db), TIKTOK_DIRECT_POST_ENABLED: "true" });
    assert.equal(unavailable.status, 400);
    assert.match((await unavailable.json()).error, /not currently available/);
  } finally { globalThis.fetch = originalFetch; }
});

test("TikTok draft upload validates missing video, unsupported type, connection and expiry", async () => {
  const cases = [
    [new Request("https://bingodogwash.com/api/tiktok/draft", { method: "POST", headers: { Authorization: "Bearer admin-token" } }), oauthDb(), 400, /select a video/i],
    [draftRequest("test.png", "image/png"), oauthDb(), 415, /unsupported video type/i],
    [draftRequest(), oauthDb(), 409, /TikTok Creator/i],
    [draftRequest(), oauthDb({ connection: { status: "Connected", access_token: "private-token", access_token_expires_at: new Date(Date.now() - 1000).toISOString(), scopes: "video.upload" } }), 401, /expired/i],
  ];
  for (const [request, db, status, error] of cases) {
    const response = await handleTikTokRequest(request, configuredEnv(db));
    const body = await response.json();
    assert.equal(response.status, status);
    assert.match(body.error, error);
    assert.ok(db.saved.some((entry) => entry.sql.includes("INSERT INTO marketing_posts")));
  }
});

test("TikTok draft upload refreshes an expired refreshable token before upload", async () => {
  const originalFetch = globalThis.fetch;
  const expired = { status: "Connected", access_token: "expired-private", refresh_token: "refresh-private", refresh_token_expires_at: new Date(Date.now() + 60000).toISOString(), access_token_expires_at: new Date(Date.now() - 1000).toISOString(), scopes: "user.info.basic,video.upload" };
  const fresh = { ...expired, access_token: "fresh-private", access_token_expires_at: new Date(Date.now() + 60000).toISOString() };
  const db = oauthDb({ connectionSequence: [expired, expired, fresh] });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return Response.json({ access_token: "fresh-private", refresh_token: "rotated-private", open_id: "open-id", scope: "user.info.basic,video.upload", expires_in: 86400, refresh_expires_in: 31536000 });
    if (calls.length === 2) return Response.json({ data: { publish_id: "refreshed-draft", upload_url: "https://open-upload.tiktokapis.com/video/refreshed" }, error: { code: "ok" } });
    return new Response(null, { status: 201 });
  };
  try {
    const response = await handleTikTokRequest(draftRequest(), configuredEnv(db));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).publishId, "refreshed-draft");
    assert.equal(calls[0].url, "https://open.tiktokapis.com/v2/oauth/token/");
    assert.equal(calls[1].options.headers.Authorization, "Bearer fresh-private");
    assert.equal(JSON.stringify(await db.saved).includes("expired-private"), false);
  } finally { globalThis.fetch = originalFetch; }
});

test("TikTok API failures are reported safely and added to posting history", async () => {
  const originalFetch = globalThis.fetch;
  const db = oauthDb({ connection: { status: "Connected", access_token: "private-token", access_token_expires_at: new Date(Date.now() + 60000).toISOString(), scopes: "user.info.basic,video.upload" } });
  globalThis.fetch = async () => Response.json({ data: {}, error: { code: "access_token_invalid", message: "private provider detail" } }, { status: 401 });
  try {
    const response = await handleTikTokRequest(draftRequest(), configuredEnv(db));
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.match(body.error, /invalid or expired/i);
    assert.equal(JSON.stringify(body).includes("private-token"), false);
    assert.equal(JSON.stringify(body).includes("private provider detail"), false);
    assert.ok(db.saved.some((entry) => entry.sql.includes("INSERT INTO marketing_posts") && entry.values.includes("failed")));
    assert.ok(db.saved.some((entry) => entry.sql.includes("INSERT INTO marketing_platform_results")));
  } finally { globalThis.fetch = originalFetch; }
});

test("TikTok draft upload uses video.upload inbox API and logs success without Direct Post", async () => {
  const originalFetch = globalThis.fetch;
  const db = oauthDb({ connections: { marketing: { status: "Connected", access_token: "private-token", access_token_expires_at: new Date(Date.now() + 60000).toISOString(), scopes: "user.info.basic,video.upload" } } });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return Response.json({ data: { publish_id: "draft-publish-id", upload_url: "https://open-upload.tiktokapis.com/video/upload-id" }, error: { code: "ok", message: "" } });
    return new Response(null, { status: 201 });
  };
  try {
    const response = await handleTikTokRequest(new Request("https://bingodogwash.com/api/tiktok/draft?filename=clip.mp4&context=ai-distribution&productId=product-7&productName=Dog%20Bow", {
      method: "POST", headers: { Authorization: "Bearer admin-token", "Content-Type": "video/mp4", "Content-Length": "4" }, body: new Uint8Array([1, 2, 3, 4]),
    }), configuredEnv(db));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.draftUploaded, true);
    assert.equal(body.publishId, "draft-publish-id");
    assert.equal(JSON.stringify(body).includes("private-token"), false);
    assert.equal(calls[0].url, "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/");
    assert.equal(calls[0].options.headers.Authorization, "Bearer private-token");
    const init = JSON.parse(calls[0].options.body);
    assert.deepEqual(init, { source_info: { source: "FILE_UPLOAD", video_size: 4, chunk_size: 4, total_chunk_count: 1 } });
    assert.equal(JSON.stringify(init).includes("video.publish"), false);
    assert.equal(calls[1].options.method, "PUT");
    assert.equal(calls[1].options.headers["Content-Range"], "bytes 0-3/4");
    assert.ok(db.saved.some((entry) => entry.sql.includes("INSERT INTO marketing_posts") && entry.values.includes("success")));
    assert.ok(db.saved.some((entry) => entry.sql.includes("INSERT INTO marketing_platform_results") && entry.values.includes("draft-publish-id")));
    assert.ok(db.saved.some((entry) => entry.sql.includes("INSERT INTO marketing_platform_results") && entry.values.includes('{"accountRole":"marketing"}')));
    assert.ok(db.saved.some((entry) => entry.sql.includes("INSERT INTO marketing_posts") && entry.values.includes("ai-distribution-tiktok") && entry.values.includes("product-7") && entry.values.includes("Dog Bow")));
  } finally { globalThis.fetch = originalFetch; }
});

test("Marketing admin UI provides safe TikTok connect, refresh and callback handling", () => {
  const html = readFileSync(new URL("../public/admin/marketing.html", import.meta.url), "utf8");
  const frontend = readFileSync(new URL("../public/admin/marketing.js", import.meta.url), "utf8");
  const productCentre = readFileSync(new URL("../public/admin/ai-drafts.js", import.meta.url), "utf8");
  assert.match(html, /data-action="tiktok-connect"/);
  assert.match(html, /data-action="tiktok-connect" data-account-role="creator"/);
  assert.match(html, /Reconnect TikTok Creator Only/);
  assert.match(html, /data-action="tiktok-refresh"/);
  assert.match(html, /data-tiktok-draft-test/);
  assert.match(html, /video\/mp4,video\/quicktime,video\/webm/);
  assert.match(frontend, /accountRole=\$\{encodeURIComponent\(role\)\}/);
  assert.match(html, /Connect TikTok Marketing Account/);
  assert.match(frontend, /params\.get\("tiktok"\)/);
  assert.match(frontend, /tiktokApi\}\/draft\?filename=/);
  assert.match(frontend, /64\*1024\*1024/);
  assert.match(productCentre, /adminRequest\(`\$\{tiktokApi\}\/status`/);
  assert.match(productCentre, /connect\?accountRole=marketing/);
  assert.match(productCentre, /tiktok\.directPostEnabled===true/);
  assert.match(productCentre, /direct\?"direct-post":"draft"/);
  assert.match(productCentre, /destination\.hostname!=="www\.tiktok\.com"/);
});

test("Direct Post support remains inactive and absent from scheduled automation", () => {
  const tiktok = readFileSync(new URL("../_functions_NOT_FOR_STATIC_UPLOAD/api/tiktok.js", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js", import.meta.url), "utf8");
  const marketing = readFileSync(new URL("../_functions_NOT_FOR_STATIC_UPLOAD/api/marketing.js", import.meta.url), "utf8");
  assert.match(tiktok, /publish\/inbox\/video\/init/);
  assert.match(tiktok, /publish\/video\/init/);
  assert.match(tiktok, /if \(!directPostEnabled\(env\)\) return/);
  assert.match(readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"), /"TIKTOK_DIRECT_POST_ENABLED": "false"/);
  assert.equal(marketing.includes("uploadDraft"), false);
  assert.equal(marketing.includes("directPost"), false);
  const scheduledHandler = worker.slice(worker.indexOf("async scheduled("), worker.indexOf("async fetch("));
  assert.equal(scheduledHandler.includes("TikTok"), false);
  assert.equal(scheduledHandler.includes("tiktok"), false);
});
