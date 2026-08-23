const BASE_PATH = "/api/admin/distribution-channels";
const CHANNELS = new Set(["email", "googleMerchant", "ebay"]);

export function isDistributionChannelPath(pathname) {
  return pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`);
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
  return db.prepare("SELECT channel, access_token, refresh_token FROM distribution_channel_connections WHERE channel = ? LIMIT 1").bind(channel).first();
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

export const distributionChannelTestHelpers = { capabilities, emailCapability, storedChannelCapability, unavailableChannel, mapGoogleProduct, mapEbayInventoryItem };
