const BASE_PATH = "/api/admin/distribution-channels";
const CHANNELS = new Set(["email", "googleMerchant", "ebay"]);
const GOOGLE_OAUTH_START_PATH = "/api/google/merchant/oauth/start";
const GOOGLE_OAUTH_CALLBACK_PATH = "/api/google/merchant/oauth/callback";
const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_MERCHANT_SCOPE = "https://www.googleapis.com/auth/content";
const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_REFRESH_SKEW_MS = 60 * 1000;

export function isDistributionChannelPath(pathname) {
  return pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`);
}

export function isGoogleMerchantOAuthPath(pathname) {
  return pathname === GOOGLE_OAUTH_START_PATH || pathname === GOOGLE_OAUTH_CALLBACK_PATH;
}

export async function handleGoogleMerchantOAuthRequest(request, env, url = new URL(request.url)) {
  if (request.method === "GET" && url.pathname === GOOGLE_OAUTH_CALLBACK_PATH) return googleOAuthCallback(env, url);
  if (!(await isAdmin(request, env))) return json({ ok: false, error: "Admin authorisation required." }, 401);
  if (request.method === "GET" && url.pathname === GOOGLE_OAUTH_START_PATH) return googleOAuthStart(env);
  if (isGoogleMerchantOAuthPath(url.pathname)) return json({ ok: false, error: "Method not allowed." }, 405);
  return json({ ok: false, error: "Google Merchant OAuth endpoint not found." }, 404);
}

export async function handleDistributionChannelRequest(request, env, url = new URL(request.url)) {
  if (!(await isAdmin(request, env))) return json({ ok: false, error: "Admin authorisation required." }, 401);
  if (request.method === "GET" && (url.pathname === BASE_PATH || url.pathname === `${BASE_PATH}/`)) return status(env);
  const parts = url.pathname.slice(`${BASE_PATH}/`.length).split("/");
  const channel = parts[0];
  const action = parts[1];
  if (!CHANNELS.has(channel)) return json({ ok: false, error: "Distribution channel not found." }, 404);
  if (request.method === "GET" && action === "connect") return json({ ok: false, error: connectionMessage(channel, env) }, 503);
  if (request.method === "POST" && action === "distribute") return distribute(request, channel, env);
  return json({ ok: false, error: "Method not allowed." }, 405);
}

async function status(env) {
  const ids = ["email", "googleMerchant", "ebay"];
  const results = await Promise.allSettled([
    emailCapability(env),
    storedChannelCapability(env, "googleMerchant"),
    storedChannelCapability(env, "ebay"),
  ]);
  const channels = Object.fromEntries(ids.map((id, index) => [id,
    results[index].status === "fulfilled" ? results[index].value : unavailableChannel(id)
  ]));
  return json({ ok: true, channels });
}

async function storedChannelCapability(env, channel) {
  const connection = await storedConnection(env.GIFT_CARD_DB, channel);
  if (channel === "googleMerchant") return googleMerchantCapability(env, connection, false, env.GIFT_CARD_DB);
  return capabilities(env, connection ? { [channel]: connection } : {})[channel];
}

function unavailableChannel(channel) {
  return { status: "status_unavailable", label: "Status unavailable", ready: false, connected: false, actionAvailable: false, connectAvailable: false, provider: channel };
}

function capabilities(env, connections = {}) {
  const googleConfigMissing = missing(env, ["GOOGLE_MERCHANT_CLIENT_ID", "GOOGLE_MERCHANT_CLIENT_SECRET", "GOOGLE_MERCHANT_REDIRECT_URI"]);
  const googleConnection = connections.googleMerchant;
  const googleAccountMissing = missing(env, ["GOOGLE_MERCHANT_ACCOUNT_ID", "GOOGLE_MERCHANT_DATA_SOURCE"]);
  const googleConnected = Boolean(googleConnection?.access_token || googleConnection?.refresh_token);
  const googleReady = false;

  const ebayConfigMissing = missing(env, ["EBAY_SELL_CLIENT_ID", "EBAY_SELL_CLIENT_SECRET", "EBAY_SELL_RUNAME"]);
  const ebayConnection = connections.ebay;
  const ebayConnected = Boolean(ebayConnection?.access_token || ebayConnection?.refresh_token);
  const ebayListingMissing = missing(env, ["EBAY_SELL_MARKETPLACE_ID", "EBAY_SELL_LOCATION_KEY"]);
  const ebayReady = false;

  return {
    email: emailCapabilityFromConfig(env),
    googleMerchant: { status: googleConfigMissing.length ? "configuration_error" : googleConnected ? "connected" : "needs_connection", label: googleConfigMissing.length ? "Configuration error" : googleConnected ? "Connected" : "Needs connection", ready: googleReady, connected: googleConnected, actionAvailable: false, connectAvailable: false, provider: "Google Merchant API", accountConfigured: googleAccountMissing.length === 0, missing: [...googleConfigMissing, ...googleAccountMissing, "Google Merchant OAuth/sync connector"] },
    ebay: { status: "draft_only", label: "Draft only", ready: ebayReady, connected: ebayConnected, actionAvailable: false, connectAvailable: false, provider: ebayConnected ? "eBay Sell APIs" : (configured(env.EBAY_BROWSE_CLIENT_ID) && configured(env.EBAY_BROWSE_CLIENT_SECRET) ? "eBay Browse API only" : "None"), missing: [...ebayConfigMissing, ...ebayListingMissing, "eBay seller OAuth/Inventory connector"] },
  };
}

async function googleMerchantCapability(env, connection, connectionLookupError = false, db = null) {
  const configMissing = missing(env, ["GOOGLE_MERCHANT_CLIENT_ID", "GOOGLE_MERCHANT_CLIENT_SECRET", "GOOGLE_MERCHANT_REDIRECT_URI", "GOOGLE_MERCHANT_ACCOUNT_ID"]);
  if (configMissing.length) return integrationState("not_configured", "Not configured", false, "Google Merchant API", configMissing, { connected: Boolean(connection?.access_token || connection?.refresh_token) });
  if (connectionLookupError) return integrationState("connection_error", "Connection error", false, "Google Merchant API", ["OAuth connection status unavailable"]);
  if (!connection?.access_token && !connection?.refresh_token) return integrationState("reconnect_required", "Reconnect required", false, "Google Merchant API", ["Google Merchant OAuth connection"], { connected: false });
  if (String(connection.status || "").toLowerCase() === "disconnected") return integrationState("reconnect_required", "Reconnect required", false, "Google Merchant API", ["Google Merchant OAuth connection"], { connected: false });

  let accessToken = String(connection.access_token || "").trim();
  const expiresAt = Date.parse(connection.token_expires_at || "");
  if (!accessToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now() + GOOGLE_REFRESH_SKEW_MS) {
    if (!connection.refresh_token) return integrationState("reconnect_required", "Reconnect required", false, "Google Merchant API", ["Google Merchant refresh token"], { connected: false });
    const refreshed = await refreshGoogleAccessToken(env, connection.refresh_token);
    if (refreshed.status === "reconnect_required") return integrationState("reconnect_required", "Reconnect required", false, "Google Merchant API", ["Google Merchant OAuth connection"], { connected: false });
    if (refreshed.status === "connection_error") return integrationState("connection_error", "Connection error", false, "Google Merchant API", ["Google OAuth token refresh unavailable"]);
    accessToken = refreshed.accessToken;
    if (db) {
      try { await persistRefreshedGoogleToken(db, refreshed); }
      catch { return integrationState("connection_error", "Connection error", false, "Google Merchant API", ["Google OAuth token persistence unavailable"]); }
    }
  }

  const health = await googleMerchantHealth(env, accessToken);
  if (health === "connected") return integrationState("connected", "Connected", true, "Google Merchant API", [], { connected: true, accountConfigured: true });
  if (health === "reconnect_required") return integrationState("reconnect_required", "Reconnect required", false, "Google Merchant API", ["Google Merchant OAuth connection"], { connected: false, accountConfigured: true });
  return integrationState("connection_error", "Connection error", false, "Google Merchant API", ["Google Merchant account health check failed"], { connected: true, accountConfigured: true });
}

async function refreshGoogleAccessToken(env, refreshToken) {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: String(env.GOOGLE_MERCHANT_CLIENT_ID),
        client_secret: String(env.GOOGLE_MERCHANT_CLIENT_SECRET),
        refresh_token: String(refreshToken),
        grant_type: "refresh_token",
      }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { status: body?.error === "invalid_grant" || response.status === 401 ? "reconnect_required" : "connection_error", accessToken: "" };
    const accessToken = String(body?.access_token || "").trim();
    return accessToken ? { status: "connected", accessToken, expiresIn: positiveSeconds(body?.expires_in, 3600), tokenType: clean(body?.token_type || "Bearer", 40), scope: clean(body?.scope, 1000) } : { status: "connection_error", accessToken: "" };
  } catch {
    return { status: "connection_error", accessToken: "" };
  }
}

async function googleOAuthStart(env) {
  const configMissing = missing(env, ["GOOGLE_MERCHANT_CLIENT_ID", "GOOGLE_MERCHANT_CLIENT_SECRET", "GOOGLE_MERCHANT_REDIRECT_URI", "GOOGLE_MERCHANT_ACCOUNT_ID"]);
  if (configMissing.length || !env.GIFT_CARD_DB) return json({ ok: false, error: "Google Merchant OAuth is not configured." }, 503);
  const state = randomToken(32);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + GOOGLE_STATE_TTL_MS).toISOString();
  try {
    await env.GIFT_CARD_DB.prepare(`INSERT INTO distribution_channel_connections (channel, status, oauth_state, oauth_state_expires_at, updated_at)
      VALUES ('googleMerchant', 'Disconnected', ?, ?, ?)
      ON CONFLICT(channel) DO UPDATE SET oauth_state=excluded.oauth_state, oauth_state_expires_at=excluded.oauth_state_expires_at, updated_at=excluded.updated_at`)
      .bind(state, expiresAt, now).run();
  } catch { return json({ ok: false, error: "Google Merchant OAuth state could not be initialised." }, 500); }
  const authorize = new URL(GOOGLE_AUTHORIZE_URL);
  authorize.searchParams.set("client_id", String(env.GOOGLE_MERCHANT_CLIENT_ID));
  authorize.searchParams.set("redirect_uri", String(env.GOOGLE_MERCHANT_REDIRECT_URI));
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", GOOGLE_MERCHANT_SCOPE);
  authorize.searchParams.set("access_type", "offline");
  authorize.searchParams.set("prompt", "consent");
  authorize.searchParams.set("include_granted_scopes", "true");
  authorize.searchParams.set("state", state);
  return json({ ok: true, url: authorize.toString() });
}

async function googleOAuthCallback(env, url) {
  const result = (value) => Response.redirect(`https://admin.bingodogwash.com/admin/ai-drafts.html?merchant=${encodeURIComponent(value)}`, 302);
  if (!env.GIFT_CARD_DB) return result("connection_error");
  const state = clean(url.searchParams.get("state"), 512);
  if (!state) return result("invalid_state");
  let guard;
  try {
    guard = await env.GIFT_CARD_DB.prepare(`UPDATE distribution_channel_connections
      SET oauth_state='', updated_at=?
      WHERE channel='googleMerchant' AND oauth_state=?
      RETURNING refresh_token, oauth_state_expires_at`).bind(new Date().toISOString(), state).first();
  } catch { return result("connection_error"); }
  if (!guard) return result("invalid_state");
  if (!guard.oauth_state_expires_at || Date.parse(guard.oauth_state_expires_at) <= Date.now()) return result("expired_state");
  if (url.searchParams.get("error")) return result("denied");
  const code = clean(url.searchParams.get("code"), 4096);
  if (!code) return result("missing_code");
  if (missing(env, ["GOOGLE_MERCHANT_CLIENT_ID", "GOOGLE_MERCHANT_CLIENT_SECRET", "GOOGLE_MERCHANT_REDIRECT_URI", "GOOGLE_MERCHANT_ACCOUNT_ID"]).length) return result("not_configured");
  let response;
  let token;
  try {
    response = await fetch(GOOGLE_TOKEN_URL, { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded", Accept:"application/json"}, body:new URLSearchParams({ client_id:String(env.GOOGLE_MERCHANT_CLIENT_ID), client_secret:String(env.GOOGLE_MERCHANT_CLIENT_SECRET), code, grant_type:"authorization_code", redirect_uri:String(env.GOOGLE_MERCHANT_REDIRECT_URI) }) });
    token = await response.json().catch(() => null);
  } catch { return result("connection_error"); }
  if (!response.ok || !configured(token?.access_token)) return result(token?.error === "invalid_grant" ? "reconnect_required" : "connection_error");
  const refreshToken = clean(token?.refresh_token, 4096) || clean(guard.refresh_token, 4096);
  if (!refreshToken) return result("reconnect_required");
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + positiveSeconds(token?.expires_in, 3600) * 1000).toISOString();
  try {
    await env.GIFT_CARD_DB.prepare(`UPDATE distribution_channel_connections SET status='Connected', access_token=?, refresh_token=?, token_type=?, token_expires_at=?, scopes=?, connected_at=CASE WHEN connected_at='' THEN ? ELSE connected_at END, disconnected_at='', updated_at=? WHERE channel='googleMerchant'`)
      .bind(clean(token.access_token, 4096), refreshToken, clean(token.token_type || "Bearer", 40), expiresAt, clean(token.scope, 1000) || GOOGLE_MERCHANT_SCOPE, now, now).run();
  } catch { return result("connection_error"); }
  const health = await googleMerchantHealth(env, token.access_token);
  return result(health === "connected" ? "connected" : health);
}

async function persistRefreshedGoogleToken(db, refreshed) {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + positiveSeconds(refreshed.expiresIn, 3600) * 1000).toISOString();
  await db.prepare(`UPDATE distribution_channel_connections SET status='Connected', access_token=?, token_type=?, token_expires_at=?, scopes=CASE WHEN ?='' THEN scopes ELSE ? END, updated_at=? WHERE channel='googleMerchant'`)
    .bind(clean(refreshed.accessToken, 4096), clean(refreshed.tokenType || "Bearer", 40), expiresAt, clean(refreshed.scope, 1000), clean(refreshed.scope, 1000), now).run();
}

async function googleMerchantHealth(env, accessToken) {
  try {
    const accountId = String(env.GOOGLE_MERCHANT_ACCOUNT_ID || "").trim().replace(/^accounts\//, "");
    const response = await fetch(`https://merchantapi.googleapis.com/accounts/v1/accounts/${encodeURIComponent(accountId)}`, { method:"GET", headers:{Authorization:`Bearer ${accessToken}`, Accept:"application/json"} });
    if (response.ok) return "connected";
    return response.status === 401 || response.status === 403 ? "reconnect_required" : "connection_error";
  } catch { return "connection_error"; }
}

function randomToken(bytes) { const value=new Uint8Array(bytes);crypto.getRandomValues(value);return btoa(String.fromCharCode(...value)).replaceAll("+","-").replaceAll("/","_").replace(/=+$/g,""); }
function positiveSeconds(value, fallback) { const number=Number(value);return Number.isFinite(number)&&number>0?Math.floor(number):fallback; }
function clean(value, max=500) { return String(value||"").replace(/[\r\n\0]/g,"").trim().slice(0,max); }
function integrationState(status, label, connected, provider, missingItems, extra = {}) { return { status, label, ready: false, connected, actionAvailable: false, connectAvailable: false, provider, missing: missingItems, ...extra }; }

async function distribute(request, channel, env) {
  const channelStatus = channel === "email" ? await emailCapability(env) : capabilities(env)[channel];
  if (!channelStatus.ready) return json({ ok: false, channel, error: `${channelStatus.label}. Complete the reported server-side configuration before distribution.` }, 409);
  if (channel === "email") {
    let input;
    try { input = await request.json(); } catch { return json({ ok: false, channel, error: "Invalid JSON request." }, 400); }
    if (input?.confirmed !== true) return json({ ok: false, channel, error: "Email distribution must be explicitly reviewed and confirmed." }, 400);
    const subject = String(input.subject || "").trim().slice(0, 200);
    const text = String(input.text || "").trim().slice(0, 20000);
    if (!subject || !text) return json({ ok: false, channel, error: "Email subject and content are required." }, 400);
    if (["recipients", "recipient", "to", "cc", "bcc"].some((field) => field in input)) return json({ ok: false, channel, error: "Recipients cannot be supplied by campaign content." }, 400);
    const recipients = await approvedRecipients(env.GIFT_CARD_DB);
    if (!recipients.length) return json({ ok: false, channel, error: "No opted-in newsletter subscribers are available." }, 409);
    try {
      for (const recipient of recipients) {
        await env.EMAIL.send({ to: recipient, from: { email: String(env.AI_EMAIL_SENDER_EMAIL).trim(), name: String(env.AI_EMAIL_SENDER_NAME).trim() }, subject, text, html: `<p>${escapeHtml(text).replace(/\n/g,"<br>")}</p>` });
      }
      return json({ ok: true, channel, sent: true, recipientCount: recipients.length });
    } catch { return json({ ok: false, channel, error: "Email provider rejected the send request." }, 502); }
  }
  return json({ ok: false, channel, error: "Distribution connector is not activated." }, 503);
}

function emailCapabilityFromConfig(env) {
  if (!env.EMAIL) return emailState("draft_only", "Draft only", ["EMAIL binding"]);
  const missingConfig = missing(env, ["AI_EMAIL_SENDER_NAME", "AI_EMAIL_SENDER_EMAIL", "AI_EMAIL_RECIPIENT_SOURCE"]);
  if (missingConfig.length) return emailState("needs_configuration", "Needs configuration", missingConfig);
  if (!validEmail(env.AI_EMAIL_SENDER_EMAIL) || !String(env.AI_EMAIL_SENDER_EMAIL).trim().toLowerCase().endsWith("@bingodogwash.com")) return emailState("configuration_error", "Configuration error", ["AI_EMAIL_SENDER_EMAIL must be a valid @bingodogwash.com address"]);
  if (String(env.AI_EMAIL_RECIPIENT_SOURCE).trim() !== "newsletter_subscribers") return emailState("configuration_error", "Configuration error", ["AI_EMAIL_RECIPIENT_SOURCE must be newsletter_subscribers"]);
  if (!env.GIFT_CARD_DB) return emailState("configuration_error", "Configuration error", ["GIFT_CARD_DB binding"]);
  if (!enabled(env.AI_EMAIL_SENDING_ENABLED)) return emailState("sending_disabled", "Sending disabled", ["AI_EMAIL_SENDING_ENABLED=true"]);
  return emailState("ready", "Ready", []);
}

async function emailCapability(env) {
  const configuredState = emailCapabilityFromConfig(env);
  if (["draft_only", "needs_configuration", "configuration_error"].includes(configuredState.status)) return configuredState;
  try {
    const result = await env.GIFT_CARD_DB.prepare("SELECT COUNT(*) AS total FROM newsletter_subscribers WHERE lower(status) = 'subscribed'").first();
    const recipientCount = Number(result?.total || 0);
    if (!Number.isSafeInteger(recipientCount) || recipientCount < 0) return emailState("configuration_error", "Configuration error", ["Invalid newsletter subscriber count"]);
    if (recipientCount === 0) return emailState("needs_configuration", "Needs configuration", ["At least one opted-in newsletter subscriber"]);
    return { ...configuredState, recipientCount };
  } catch {
    return emailState("configuration_error", "Configuration error", ["newsletter_subscribers source unavailable"]);
  }
}

function emailState(status, label, missingItems) {
  const ready = status === "ready";
  return { status, label, ready, connected: status !== "draft_only", actionAvailable: ready, connectAvailable: false, provider: status === "draft_only" ? "None" : "Cloudflare Email Sending", recipientSource: "newsletter_subscribers", missing: missingItems };
}

async function approvedRecipients(db) {
  const result = await db.prepare("SELECT email FROM newsletter_subscribers WHERE lower(status) = 'subscribed' ORDER BY subscribed_at ASC LIMIT 1000").all();
  return [...new Set((result.results || []).map((row) => String(row.email || "").trim().toLowerCase()).filter(validEmail))];
}

async function storedConnection(db, channel) {
  if (!db) return null;
  return db.prepare("SELECT channel, status, access_token, refresh_token, token_expires_at, scopes, connected_at, updated_at FROM distribution_channel_connections WHERE channel = ? LIMIT 1").bind(channel).first();
}

function connectionMessage(channel, env) {
  const info = capabilities(env)[channel];
  return info.connectAvailable ? `${info.provider} OAuth connection is not activated yet.` : `${info.label}: ${info.missing.join(", ")}.`;
}
function missing(env, names) { return names.filter((name) => !configured(env[name])); }
function configured(value) { return typeof value === "string" && value.trim().length > 0; }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim()); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]); }
function enabled(value) { return /^(1|true|yes|on)$/i.test(String(value || "").trim()); }
async function isAdmin(request, env) { const expected=String(env.ADMIN_API_TOKEN||"");const supplied=(request.headers.get("Authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1]||request.headers.get("X-Admin-Token")||"";if(!expected||!supplied)return false;const [a,b]=await Promise.all([hash(expected),hash(supplied)]);if(a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i+=1)result|=a[i]^b[i];return result===0; }
async function hash(value) { return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))); }
function json(body, status=200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store" } }); }

function mapGoogleProduct(product) {
  const price = Number(product?.price);
  return { offerId:String(product?.sku||product?.id||"").slice(0,50), contentLanguage:"en", feedLabel:"GB", productAttributes:{ title:String(product?.name||"").slice(0,150), description:String(product?.description||"").slice(0,5000), link:httpsUrl(product?.url), imageLink:httpsUrl(product?.image), availability:"IN_STOCK", condition:"NEW", brand:"Bingo Dog Wash", price:{ amountMicros:Number.isFinite(price)&&price>0?String(Math.round(price*1000000)):"", currencyCode:String(product?.currency||"GBP").slice(0,3) } } };
}
function mapEbayInventoryItem(product) { return { sku:String(product?.sku||product?.id||"").slice(0,50), availability:{ shipToLocationAvailability:{ quantity:Number.isInteger(product?.stock)&&product.stock>=0?product.stock:0 } }, condition:"NEW", product:{ title:String(product?.name||"").slice(0,80), description:String(product?.description||"").slice(0,4000), imageUrls:[httpsUrl(product?.image)].filter(Boolean) } }; }
function httpsUrl(value) { try { const url=new URL(String(value||""));return url.protocol==="https:"?url.toString():""; } catch { return ""; } }

export const distributionChannelTestHelpers = { capabilities, emailCapability, storedChannelCapability, unavailableChannel, googleMerchantCapability, refreshGoogleAccessToken, googleMerchantHealth, mapGoogleProduct, mapEbayInventoryItem };
