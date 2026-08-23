const CONNECT_PATH = "/api/tiktok/connect";
const CALLBACK_PATH = "/api/tiktok/callback";
const STATUS_PATH = "/api/tiktok/status";
const REFRESH_PATH = "/api/tiktok/refresh";
const DRAFT_PATH = "/api/tiktok/draft";
const DIRECT_POST_PATH = "/api/tiktok/direct-post";
const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const DRAFT_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
const DIRECT_POST_INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const CREATOR_INFO_URL = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name";
const DEFAULT_REDIRECT_URI = "https://bingodogwash.com/api/tiktok/callback";
const STATE_TTL_MS = 10 * 60 * 1000;
const BASE_SCOPES = ["user.info.basic", "video.upload"];
const MAX_DRAFT_VIDEO_BYTES = 64 * 1024 * 1024;
const SUPPORTED_VIDEO_TYPES = new Map([["video/mp4", ".mp4"], ["video/quicktime", ".mov"], ["video/webm", ".webm"]]);
const ACCOUNT_ROLES = new Set(["creator", "marketing"]);

export function isTikTokPath(pathname) {
  return pathname === CONNECT_PATH || pathname === CALLBACK_PATH || pathname === STATUS_PATH || pathname === REFRESH_PATH || pathname === DRAFT_PATH || pathname === DIRECT_POST_PATH;
}

export async function handleTikTokRequest(request, env, url = new URL(request.url)) {
  if (request.method === "GET" && url.pathname === CALLBACK_PATH) return callback(request, env, url);
  if (!(await isAdmin(request, env))) return json({ ok: false, error: "Admin authorisation required." }, 401);
  if (request.method === "GET" && url.pathname === CONNECT_PATH) return connect(env, accountRole(url));
  if (request.method === "GET" && url.pathname === STATUS_PATH) return status(env);
  if (request.method === "POST" && url.pathname === REFRESH_PATH) return refresh(env, accountRole(url));
  if (request.method === "POST" && url.pathname === DRAFT_PATH) return uploadDraft(request, env, url);
  if (request.method === "POST" && url.pathname === DIRECT_POST_PATH) return directPost(request, env, url);
  if (url.pathname === CONNECT_PATH || url.pathname === STATUS_PATH || url.pathname === REFRESH_PATH || url.pathname === DRAFT_PATH || url.pathname === DIRECT_POST_PATH) return json({ ok: false, error: "Method not allowed." }, 405);
  return json({ ok: false, error: "TikTok endpoint not found." }, 404);
}

async function connect(env, role) {
  const oauthCredentials = credentials(env);
  if (!env.GIFT_CARD_DB) return json({ ok: false, error: "Marketing database unavailable." }, 503);
  if (!configured(oauthCredentials.clientKey) || !configured(env.TIKTOK_REDIRECT_URI)) {
    return json({ ok: false, error: "TikTok OAuth is not configured." }, 503);
  }
  const state = randomToken(32);
  const now = new Date().toISOString();
  await env.GIFT_CARD_DB.prepare("INSERT OR REPLACE INTO marketing_one_time_guards (action_key, created_at) VALUES (?, ?)")
    .bind(`tiktok_oauth_state:${role}:${state}`, now).run();
  const authorize = new URL(AUTHORIZE_URL);
  authorize.searchParams.set("client_key", oauthCredentials.clientKey);
  authorize.searchParams.set("scope", requestedScopes(env).join(","));
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri(env));
  authorize.searchParams.set("state", `${role}.${state}`);
  return json({ ok: true, url: authorize.toString() });
}

async function callback(_request, env, url) {
  const oauthCredentials = credentials(env);
  if (!env.GIFT_CARD_DB) return callbackRedirect("server_error");
  const stateValue = clean(url.searchParams.get("state"), 256);
  const separator = stateValue.indexOf(".");
  const role = separator > 0 ? cleanRole(stateValue.slice(0, separator)) : "creator";
  const state = separator > 0 ? stateValue.slice(separator + 1) : stateValue;
  const code = clean(url.searchParams.get("code"), 2048);
  const providerError = clean(url.searchParams.get("error"), 100);
  if (!state) return callbackRedirect("invalid_state");
  const guard = await env.GIFT_CARD_DB.prepare("DELETE FROM marketing_one_time_guards WHERE action_key = ? RETURNING created_at")
    .bind(`tiktok_oauth_state:${role}:${state}`).first();
  if (!guard?.created_at || Date.now() - Date.parse(guard.created_at) > STATE_TTL_MS) return callbackRedirect("invalid_state");
  if (providerError) return callbackRedirect("provider_error");
  if (!code) return callbackRedirect("missing_code");
  if (!configured(oauthCredentials.clientKey) || !configured(oauthCredentials.clientSecret) || !configured(env.TIKTOK_REDIRECT_URI)) {
    return callbackRedirect("server_error");
  }
  try {
    const form = new URLSearchParams({
      client_key: oauthCredentials.clientKey,
      client_secret: oauthCredentials.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(env),
    });
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-store" },
      body: form,
    });
    let token = null;
    try { token = await response.json(); } catch { token = null; }
    if (!response.ok || !token?.access_token || !token?.refresh_token || !token?.open_id) {
      console.error(JSON.stringify({ event: "tiktok_oauth_failure", stage: "token_exchange", status: response.status }));
      return callbackRedirect("token_exchange_failed");
    }
    const tokenScopes = String(token.scope || "").split(/[ ,]+/).filter(Boolean);
    if (!BASE_SCOPES.every((scope) => tokenScopes.includes(scope))) {
      console.error(JSON.stringify({ event: "tiktok_oauth_failure", stage: "required_scopes", role }));
      return callbackRedirect("required_scopes_missing", role);
    }
    const profile = await loadProfile(token.access_token);
    if (!profile.open_id || clean(profile.open_id, 255) !== clean(token.open_id, 255) || !clean(profile.display_name, 255)) {
      console.error(JSON.stringify({ event: "tiktok_oauth_failure", stage: "identity_verification", role }));
      return callbackRedirect("identity_verification_failed", role);
    }
    await saveConnection(env.GIFT_CARD_DB, role, token, profile);
    return callbackRedirect("success", role);
  } catch {
    console.error(JSON.stringify({ event: "tiktok_oauth_failure", stage: "token_exchange", status: 0 }));
    return callbackRedirect("token_exchange_failed");
  }
}

async function saveConnection(db, role, token, profile = {}) {
  const now = new Date().toISOString();
  const accessExpiresAt = new Date(Date.now() + positiveSeconds(token.expires_in, 86400) * 1000).toISOString();
  const refreshExpiresAt = new Date(Date.now() + positiveSeconds(token.refresh_expires_in, 31536000) * 1000).toISOString();
  await db.prepare(`INSERT INTO tiktok_connections
    (id, account_role, status, open_id, access_token, refresh_token, token_type, access_token_expires_at, refresh_token_expires_at, scopes, display_name, username, connected_at, updated_at)
    VALUES (?, ?, 'Connected', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status = 'Connected', open_id = excluded.open_id, access_token = excluded.access_token,
      refresh_token = excluded.refresh_token, token_type = excluded.token_type, access_token_expires_at = excluded.access_token_expires_at,
      refresh_token_expires_at = excluded.refresh_token_expires_at, scopes = excluded.scopes,
      display_name = COALESCE(NULLIF(excluded.display_name, ''), tiktok_connections.display_name),
      username = COALESCE(NULLIF(excluded.username, ''), tiktok_connections.username),
      connected_at = COALESCE(NULLIF(tiktok_connections.connected_at, ''), excluded.connected_at), updated_at = excluded.updated_at`)
    .bind(role, role, clean(token.open_id, 255), clean(token.access_token, 4096), clean(token.refresh_token, 4096), clean(token.token_type || "Bearer", 40),
      accessExpiresAt, refreshExpiresAt, clean(token.scope, 1000), clean(profile.display_name, 255), clean(profile.username, 255), now, now).run();
}

async function status(env) {
  const oauthCredentials = credentials(env);
  const configuredValue = configured(oauthCredentials.clientKey) && configured(oauthCredentials.clientSecret) && configured(env.TIKTOK_REDIRECT_URI);
  let connections = [];
  if (env.GIFT_CARD_DB) {
    try {
      connections = (await env.GIFT_CARD_DB.prepare("SELECT account_role, status, open_id, access_token, refresh_token, access_token_expires_at, scopes, display_name, username, updated_at FROM tiktok_connections WHERE account_role IN ('creator', 'marketing')").all()).results || [];
    } catch {
      connections = [];
    }
  }
  const shape = (role) => {
    const connection = connections.find((item) => item.account_role === role);
    const scopes = String(connection?.scopes || "").split(/[ ,]+/).filter(Boolean);
    const tokenPresent = Boolean(connection?.access_token);
    const refreshTokenPresent = Boolean(connection?.refresh_token);
    const tokenUnexpired = tokenPresent && (!connection.access_token_expires_at || Date.parse(connection.access_token_expires_at) > Date.now());
    return { role, connected: connection?.status === "Connected" && tokenUnexpired && scopes.includes("video.upload"), tokenPresent, refreshTokenPresent, storedConnectionRetained: tokenPresent || refreshTokenPresent, accessTokenExpired: tokenPresent && !tokenUnexpired, scopesAvailable: scopes, displayName: connection?.display_name || "", username: connection?.username || "", openId: connection?.open_id || "", updatedAt: connection?.updated_at || "" };
  };
  const creator = shape("creator");
  const marketing = shape("marketing");
  marketing.directPostReady = marketing.connected && marketing.scopesAvailable.includes("video.publish");
  return json({
    ok: true,
    tiktok: {
      configured: configuredValue,
      environment: oauthCredentials.environment,
      connected: marketing.connected,
      tokenPresent: marketing.tokenPresent,
      scopesAvailable: marketing.scopesAvailable,
      scopesRequested: requestedScopes(env),
      directPostEnabled: directPostEnabled(env),
      directPostReady: directPostEnabled(env) && marketing.directPostReady,
      updatedAt: marketing.updatedAt,
      accounts: { creator, marketing },
    },
  });
}

async function directPost(request, env, url) {
  if (!directPostEnabled(env)) return json({ ok: false, directPostEnabled: false, error: "TikTok Direct Post is disabled." }, 409);
  if (url.searchParams.get("confirmed") !== "true") return json({ ok: false, error: "TikTok Direct Post requires explicit admin confirmation." }, 400);
  const fileName = clean(decodeFileName(url.searchParams.get("filename")), 255);
  const contentType = String(request.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
  const fileSize = Number(request.headers.get("Content-Length") || 0);
  const title = clean(decodeFileName(url.searchParams.get("title")), 2200);
  const privacyLevel = clean(url.searchParams.get("privacyLevel"), 40);
  const details = { fileName: fileName || "No video selected", fileSize: Number.isFinite(fileSize) ? fileSize : 0, context: "ai-distribution", accountRole: "marketing", productId: clean(decodeFileName(url.searchParams.get("productId")), 120), productName: clean(decodeFileName(url.searchParams.get("productName")), 160) };
  if (!request.body || !Number.isInteger(fileSize) || fileSize <= 0) return directPostResponse(env, details, 400, "Select a video before publishing to TikTok.");
  const expectedExtension = SUPPORTED_VIDEO_TYPES.get(contentType);
  if (!expectedExtension || !fileName.toLowerCase().endsWith(expectedExtension)) return directPostResponse(env, details, 415, "Unsupported video type. Choose an MP4, MOV or WebM file whose extension matches its format.");
  if (fileSize > MAX_DRAFT_VIDEO_BYTES) return directPostResponse(env, details, 413, "TikTok videos must be 64 MB or smaller.");
  if (!privacyLevel) return directPostResponse(env, details, 400, "Choose and confirm a TikTok privacy level before Direct Post.");
  if (!env.GIFT_CARD_DB) return json({ ok: false, error: "Marketing database unavailable." }, 503);
  let connection = await loadDraftConnection(env.GIFT_CARD_DB, "marketing");
  if (connection === undefined) return json({ ok: false, error: "TikTok connection storage is unavailable." }, 503);
  if (connection?.status !== "Connected" || !connection?.access_token) return directPostResponse(env, details, 409, "Connect the TikTok Marketing account before using Direct Post.");
  if (connection.access_token_expires_at && Date.parse(connection.access_token_expires_at) <= Date.now()) {
    const refreshResponse = await refresh(env, "marketing");
    if (!refreshResponse.ok) return directPostResponse(env, details, 401, "TikTok Marketing access has expired and could not be refreshed.");
    connection = await loadDraftConnection(env.GIFT_CARD_DB, "marketing");
  }
  const scopes = String(connection?.scopes || "").split(/[ ,]+/).filter(Boolean);
  if (!scopes.includes("video.publish")) return directPostResponse(env, details, 403, "TikTok Marketing has not granted the video.publish permission. Reconnect it only after TikTok approval is available.");
  const creatorInfo = await queryCreatorInfo(connection.access_token);
  if (!creatorInfo.ok) return directPostResponse(env, details, creatorInfo.status, creatorInfo.error);
  if (!creatorInfo.data.privacy_level_options.includes(privacyLevel)) return directPostResponse(env, details, 400, "The confirmed TikTok privacy level is not currently available for the Marketing account.");
  let initResponse;
  let initBody;
  try {
    initResponse = await fetch(DIRECT_POST_INIT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${connection.access_token}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        post_info: { title, privacy_level: privacyLevel, disable_comment: Boolean(creatorInfo.data.comment_disabled), disable_duet: Boolean(creatorInfo.data.duet_disabled), disable_stitch: Boolean(creatorInfo.data.stitch_disabled), brand_content_toggle: false, brand_organic_toggle: true },
        source_info: { source: "FILE_UPLOAD", video_size: fileSize, chunk_size: fileSize, total_chunk_count: 1 },
      }),
    });
    initBody = await initResponse.json().catch(() => null);
  } catch { return directPostResponse(env, details, 502, "TikTok Direct Post could not be initialized."); }
  if (!initResponse.ok || initBody?.error?.code !== "ok" || !initBody?.data?.upload_url || !initBody?.data?.publish_id) return directPostResponse(env, details, 502, safeTikTokApiError(initBody, "TikTok rejected the Direct Post request."));
  const uploadUrl = safeUploadUrl(initBody.data.upload_url);
  if (!uploadUrl) return directPostResponse(env, details, 502, "TikTok returned an invalid upload destination.");
  let uploadResponse;
  try { uploadResponse = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType, "Content-Length": String(fileSize), "Content-Range": `bytes 0-${fileSize - 1}/${fileSize}` }, body: request.body }); }
  catch { return directPostResponse(env, details, 502, "The video could not be transferred to TikTok for Direct Post."); }
  if (uploadResponse.status !== 201) return directPostResponse(env, details, 502, `TikTok Direct Post transfer failed with HTTP ${uploadResponse.status}.`);
  return directPostResponse(env, details, 202, "TikTok Marketing Direct Post accepted for processing.", clean(initBody.data.publish_id, 128));
}

async function queryCreatorInfo(accessToken) {
  try {
    const response = await fetch(CREATOR_INFO_URL, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" } });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.error?.code !== "ok" || !Array.isArray(body?.data?.privacy_level_options)) return { ok: false, status: 502, error: safeTikTokApiError(body, "TikTok Marketing creator information is unavailable.") };
    return { ok: true, data: body.data };
  } catch { return { ok: false, status: 502, error: "TikTok Marketing creator information is unavailable." }; }
}

async function refresh(env, role = "creator") {
  const oauthCredentials = credentials(env);
  if (!env.GIFT_CARD_DB) return json({ ok: false, error: "Marketing database unavailable." }, 503);
  if (!configured(oauthCredentials.clientKey) || !configured(oauthCredentials.clientSecret)) return json({ ok: false, error: "TikTok OAuth is not configured." }, 503);
  let connection;
  try {
    connection = await env.GIFT_CARD_DB.prepare("SELECT refresh_token, refresh_token_expires_at FROM tiktok_connections WHERE account_role = ?").bind(role).first();
  } catch {
    return json({ ok: false, error: "TikTok connection storage is unavailable." }, 503);
  }
  if (!connection?.refresh_token) return json({ ok: false, error: `TikTok ${titleRole(role)} account is not connected.` }, 409);
  if (connection.refresh_token_expires_at && Date.parse(connection.refresh_token_expires_at) <= Date.now()) {
    return json({ ok: false, error: "TikTok connection has expired. Reconnect TikTok." }, 409);
  }
  try {
    const form = new URLSearchParams({
      client_key: oauthCredentials.clientKey,
      client_secret: oauthCredentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
    });
    const response = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-store" }, body: form });
    let token = null;
    try { token = await response.json(); } catch { token = null; }
    if (!response.ok || !token?.access_token || !token?.refresh_token || !token?.open_id) {
      console.error(JSON.stringify({ event: "tiktok_oauth_failure", stage: "token_refresh", status: response.status }));
      return json({ ok: false, error: "TikTok token refresh failed. Reconnect TikTok if this continues." }, 502);
    }
    await saveConnection(env.GIFT_CARD_DB, role, token);
    return json({ ok: true, role, refreshed: true, scopesAvailable: String(token.scope || "").split(/[ ,]+/).filter(Boolean) });
  } catch {
    console.error(JSON.stringify({ event: "tiktok_oauth_failure", stage: "token_refresh", status: 0 }));
    return json({ ok: false, error: "TikTok token refresh failed. Reconnect TikTok if this continues." }, 502);
  }
}

async function uploadDraft(request, env, url) {
  const fileName = clean(decodeFileName(url.searchParams.get("filename")), 255);
  const contentType = String(request.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
  const fileSize = Number(request.headers.get("Content-Length") || 0);
  const context = url.searchParams.get("context") === "ai-distribution" ? "ai-distribution" : "manual-test";
  const role = context === "ai-distribution" ? "marketing" : "creator";
  const details = {
    fileName: fileName || "No video selected",
    fileSize: Number.isFinite(fileSize) ? fileSize : 0,
    context, accountRole: role,
    productId: clean(decodeFileName(url.searchParams.get("productId")), 120),
    productName: clean(decodeFileName(url.searchParams.get("productName")), 160),
  };
  if (!request.body || !Number.isInteger(fileSize) || fileSize <= 0) return draftResponse(env, details, 400, "Select a video before testing TikTok draft upload.");
  const expectedExtension = SUPPORTED_VIDEO_TYPES.get(contentType);
  if (!expectedExtension || !fileName.toLowerCase().endsWith(expectedExtension)) {
    return draftResponse(env, details, 415, "Unsupported video type. Choose an MP4, MOV or WebM file whose extension matches its format.");
  }
  if (fileSize > MAX_DRAFT_VIDEO_BYTES) return draftResponse(env, details, 413, "Test videos must be 64 MB or smaller.");
  if (!env.GIFT_CARD_DB) return json({ ok: false, error: "Marketing database unavailable." }, 503);
  let connection = await loadDraftConnection(env.GIFT_CARD_DB, role);
  if (connection === undefined) {
    return json({ ok: false, error: "TikTok connection storage is unavailable." }, 503);
  }
  if (connection?.status !== "Connected" || !connection?.access_token) return draftResponse(env, details, 409, `Connect the TikTok ${titleRole(role)} account before uploading a draft.`);
  if (connection.access_token_expires_at && Date.parse(connection.access_token_expires_at) <= Date.now()) {
    const refreshResponse = await refresh(env, role);
    if (!refreshResponse.ok) return draftResponse(env, details, 401, "TikTok access token has expired and could not be refreshed. Reconnect TikTok, then try again.");
    connection = await loadDraftConnection(env.GIFT_CARD_DB, role);
    if (!connection?.access_token || (connection.access_token_expires_at && Date.parse(connection.access_token_expires_at) <= Date.now())) {
      return draftResponse(env, details, 401, "TikTok access token has expired and could not be refreshed. Reconnect TikTok, then try again.");
    }
  }
  const scopes = String(connection.scopes || "").split(/[ ,]+/).filter(Boolean);
  if (!scopes.includes("video.upload")) return draftResponse(env, details, 403, "TikTok connection does not include the video.upload permission. Reconnect TikTok.");
  let initResponse;
  let initBody;
  try {
    initResponse = await fetch(DRAFT_INIT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${connection.access_token}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ source_info: { source: "FILE_UPLOAD", video_size: fileSize, chunk_size: fileSize, total_chunk_count: 1 } }),
    });
    initBody = await initResponse.json().catch(() => null);
  } catch {
    return draftResponse(env, details, 502, "TikTok draft upload could not be initialized.");
  }
  if (!initResponse.ok || initBody?.error?.code !== "ok" || !initBody?.data?.upload_url || !initBody?.data?.publish_id) {
    return draftResponse(env, details, 502, safeTikTokApiError(initBody, "TikTok rejected the draft upload request."));
  }
  const uploadUrl = safeUploadUrl(initBody.data.upload_url);
  if (!uploadUrl) return draftResponse(env, details, 502, "TikTok returned an invalid upload destination.");
  let uploadResponse;
  try {
    uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType, "Content-Length": String(fileSize), "Content-Range": `bytes 0-${fileSize - 1}/${fileSize}` },
      body: request.body,
    });
  } catch {
    return draftResponse(env, details, 502, "The video could not be transferred to TikTok.");
  }
  if (uploadResponse.status !== 201) return draftResponse(env, details, 502, `TikTok video transfer failed with HTTP ${uploadResponse.status}.`);
  return draftResponse(env, details, 200, "TikTok draft uploaded. Open the TikTok inbox notification to edit and post it.", clean(initBody.data.publish_id, 128));
}

async function draftResponse(env, details, status, message, publishId = "") {
  const ok = status >= 200 && status < 300;
  if (env.GIFT_CARD_DB) {
    const now = new Date().toISOString();
    const postId = crypto.randomUUID();
    const aiDistribution = details.context === "ai-distribution";
    const campaignCode = `bdw-${aiDistribution ? "ai-tiktok" : "tiktok-draft"}-${now.slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8)}`;
    const triggerType = aiDistribution ? "ai-distribution-tiktok" : "tiktok-draft-test";
    const productId = aiDistribution && details.productId ? details.productId : clean(details.fileName, 255);
    const productName = aiDistribution && details.productName ? details.productName : `TikTok draft: ${clean(details.fileName, 220)}`;
    try {
      await env.GIFT_CARD_DB.prepare(`INSERT INTO marketing_posts
        (id, product_source, product_id, product_name, product_url, product_image, caption, campaign_code, status, trigger_type, attempt_count, scheduled_at, posted_at, error_message, created_at, updated_at)
        VALUES (?, 'manual', ?, ?, '', '', 'TikTok draft upload', ?, ?, ?, 1, ?, ?, ?, ?, ?)`)
        .bind(postId, productId, productName, campaignCode, ok ? "success" : "failed", triggerType, now, ok ? now : "", ok ? "" : clean(message, 1000), now, now).run();
      await env.GIFT_CARD_DB.prepare(`INSERT INTO marketing_platform_results
        (id, post_id, platform, status, external_post_id, attempt_count, error_message, metadata, created_at, updated_at)
        VALUES (?, ?, 'tiktok', ?, ?, 1, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), postId, ok ? "success" : "failed", publishId, ok ? "" : clean(message, 1000), JSON.stringify({ accountRole: details.accountRole }), now, now).run();
    } catch {
      console.error(JSON.stringify({ event: "tiktok_draft_log_failure", status: ok ? "success" : "failed" }));
    }
  }
  return json({ ok, draftUploaded: ok, accountRole: details.accountRole, publishId: ok ? publishId : "", message: ok ? message : "", error: ok ? "" : message }, status);
}

async function directPostResponse(env, details, status, message, publishId = "") {
  const ok = status >= 200 && status < 300;
  if (env.GIFT_CARD_DB) {
    const now = new Date().toISOString();
    const postId = crypto.randomUUID();
    const campaignCode = `bdw-ai-tiktok-direct-${now.slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8)}`;
    try {
      await env.GIFT_CARD_DB.prepare(`INSERT INTO marketing_posts
        (id, product_source, product_id, product_name, product_url, product_image, caption, campaign_code, status, trigger_type, attempt_count, scheduled_at, posted_at, error_message, created_at, updated_at)
        VALUES (?, 'manual', ?, ?, '', '', 'TikTok Marketing Direct Post', ?, ?, 'ai-distribution-tiktok-direct', 1, ?, ?, ?, ?, ?)`)
        .bind(postId, details.productId || clean(details.fileName, 255), details.productName || `TikTok Direct Post: ${clean(details.fileName, 210)}`, campaignCode, ok ? "processing" : "failed", now, ok ? now : "", ok ? "" : clean(message, 1000), now, now).run();
      await env.GIFT_CARD_DB.prepare(`INSERT INTO marketing_platform_results
        (id, post_id, platform, status, external_post_id, attempt_count, error_message, metadata, created_at, updated_at)
        VALUES (?, ?, 'tiktok', ?, ?, 1, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), postId, ok ? "processing" : "failed", publishId, ok ? "" : clean(message, 1000), JSON.stringify({ accountRole: "marketing", mode: "direct-post" }), now, now).run();
    } catch { console.error(JSON.stringify({ event: "tiktok_direct_post_log_failure", status: ok ? "processing" : "failed" })); }
  }
  return json({ ok, directPosted: ok, directPostEnabled: true, accountRole: "marketing", publishId: ok ? publishId : "", message: ok ? message : "", error: ok ? "" : message }, status);
}

async function loadDraftConnection(db, role) {
  try {
    return await db.prepare("SELECT status, access_token, access_token_expires_at, scopes FROM tiktok_connections WHERE account_role = ?").bind(role).first();
  } catch { return undefined; }
}

function safeTikTokApiError(body, fallback) {
  const code = clean(body?.error?.code, 80);
  if (code === "access_token_invalid") return "TikTok access token is invalid or expired. Refresh or reconnect TikTok.";
  if (code === "scope_not_authorized") return "TikTok connection does not include the required publishing permission. Reconnect only after the required scope is approved.";
  if (code === "spam_risk_too_many_pending_share") return "TikTok has reached its pending draft limit. Complete or remove an existing draft, then try again.";
  return fallback;
}

function safeUploadUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && (url.hostname === "open-upload.tiktokapis.com" || url.hostname.endsWith(".tiktokapis.com")) ? url.toString() : "";
  } catch { return ""; }
}

function decodeFileName(value) {
  try { return decodeURIComponent(String(value || "")); } catch { return ""; }
}

function requestedScopes(env) {
  return directPostEnabled(env) ? [...BASE_SCOPES, "video.publish"] : [...BASE_SCOPES];
}

function credentials(env) {
  const environment = /^sandbox$/i.test(String(env.TIKTOK_OAUTH_ENVIRONMENT || "").trim()) ? "sandbox" : "production";
  const clientKey = environment === "sandbox" ? env.TIKTOK_SANDBOX_CLIENT_KEY : env.TIKTOK_CLIENT_KEY;
  const clientSecret = environment === "sandbox" ? env.TIKTOK_SANDBOX_CLIENT_SECRET : env.TIKTOK_CLIENT_SECRET;
  return { environment, clientKey: String(clientKey || "").trim(), clientSecret: String(clientSecret || "").trim() };
}

function directPostEnabled(env) {
  return /^(1|true|yes|on)$/i.test(String(env.TIKTOK_DIRECT_POST_ENABLED || "").trim());
}

function redirectUri(env) {
  return configured(env.TIKTOK_REDIRECT_URI) ? String(env.TIKTOK_REDIRECT_URI).trim() : DEFAULT_REDIRECT_URI;
}

function callbackRedirect(result, role = "creator") {
  const destination = new URL("https://admin.bingodogwash.com/admin/marketing");
  destination.searchParams.set("tiktok", result);
  destination.searchParams.set("tiktokRole", role);
  return new Response(null, { status: 302, headers: { Location: destination.toString(), "Cache-Control": "no-store" } });
}

function accountRole(url) { return cleanRole(url.searchParams.get("accountRole")); }
function cleanRole(value) { return ACCOUNT_ROLES.has(String(value || "").toLowerCase()) ? String(value).toLowerCase() : "creator"; }
function titleRole(role) { return role === "marketing" ? "Marketing" : "Creator"; }

async function loadProfile(accessToken) {
  try {
    const response = await fetch(USER_INFO_URL, { headers: { Authorization: `Bearer ${accessToken}`, "Cache-Control": "no-store" } });
    const body = await response.json().catch(() => null);
    return response.ok && body?.error?.code === "ok" ? (body.data?.user || {}) : {};
  } catch { return {}; }
}

async function isAdmin(request, env) {
  const expected = String(env.ADMIN_API_TOKEN || "");
  const auth = request.headers.get("Authorization") || "";
  const supplied = auth.match(/^Bearer\s+(.+)$/i)?.[1] || request.headers.get("X-Admin-Token") || "";
  if (!expected || !supplied) return false;
  const [left, right] = await Promise.all([digest(expected), digest(supplied)]);
  return timingSafeEqual(left, right);
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left[index] ^ right[index];
  return result === 0;
}

function randomToken(bytes) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
}

function positiveSeconds(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function configured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function clean(value, length) {
  return String(value || "").trim().slice(0, length);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

export const tiktokTestHelpers = { credentials, requestedScopes };
