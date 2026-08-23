const ADMIN_PATH = "/api/admin/marketing";
const TRACK_PATH = "/api/marketing/track";
const GRAPH_VERSION = "v25.0";
const INSTAGRAM_GRAPH_ORIGIN = "https://graph.instagram.com/v26.0";
const FACEBOOK_GRAPH_ORIGIN = "https://graph.facebook.com";
const INSTAGRAM_PUBLISH_PERMISSION = "instagram_content_publish";
const INSTAGRAM_PERMISSION_UNCONFIRMED = "Instagram identity verified, but publishing permission cannot be confirmed without a controlled test post.";
const FACEBOOK_REQUIRED_SCOPES = ["pages_manage_posts", "pages_read_engagement", "pages_show_list"];
const FACEBOOK_TOKEN_EXPIRED = "Facebook connection expired. Reconnect Meta account.";
const MAX_RETRIES = 3;
const MARKETING_INTERVAL_HOURS = 4;
const PRODUCT_COOLDOWN_DAYS = 7;
const ETSY_CONCORDIA_STOREFRONT = "Concordia Mercatura";
const ETSY_AFFILIATE_PROVIDER = "rakuten";
const ETSY_AFFILIATE_PROGRAM = "etsy_creator_collective_uk";
const RAKUTEN_ETSY_ADVERTISER_MID = "54080";
const RAKUTEN_AFFILIATE_ID = "FUdPmdlyOp8";
const MIN_META_TOKEN_LENGTH = 40;
const META_ERROR = {
  missing: "Meta access token is not configured.",
  invalid: "Meta connection has expired or is invalid. Reconnect Meta in server settings.",
  incomplete: "Meta account connection is incomplete.",
  permission: "Meta connection does not have permission to publish.",
  network: "Meta service is temporarily unavailable.",
};

export function isMarketingPath(pathname) {
  return pathname === ADMIN_PATH || pathname.startsWith(`${ADMIN_PATH}/`) || pathname === TRACK_PATH;
}

export async function handleMarketingRequest(request, env, url = new URL(request.url)) {
  if (url.pathname === TRACK_PATH) return trackCampaignEvent(request, env, url);
  // Meta returns through a browser navigation without the admin bearer header.
  // The callback authenticates itself with the one-time, consumed OAuth state stored in D1.
  if (request.method === "GET" && url.pathname === `${ADMIN_PATH}/oauth/callback`) {
    if (!env.GIFT_CARD_DB) return json({ ok: false, error: "Marketing database unavailable." }, 503);
    return oauthCallback(request, env, url);
  }
  if (!(await isAdmin(request, env))) return json({ ok: false, error: "Admin authorisation required." }, 401);
  if (!env.GIFT_CARD_DB) return json({ ok: false, error: "Marketing database unavailable." }, 503);

  // Allow the admin dashboard (GET). Other authenticated admin endpoints use POST.
  if (request.method === "GET" && url.pathname === ADMIN_PATH) {
    try {
      return await dashboard(env);
    } catch (error) {
      console.error(JSON.stringify({ event: "marketing_dashboard_failure", category: dashboardFailureCategory(error) }));
      return json({ ok: false, error: "Marketing status is temporarily unavailable." }, 502);
    }
  }
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);

  if (url.pathname === `${ADMIN_PATH}/test`) {
    if (publishingDisabled(env)) return publishingDisabledResponse();
    const result = await runMarketingAutomation(env, { trigger: "test", allowWhilePaused: true });
    return json(postingEndpointResponse(result, configuredFacebookPageIds(env)));
  }
  if (url.pathname === `${ADMIN_PATH}/oauth/start`) return oauthStart(request, env, url);
  if (url.pathname === `${ADMIN_PATH}/oauth/secondary/start`) return oauthStart(request, env, url, "secondary");
  if (url.pathname === `${ADMIN_PATH}/oauth/secondary/candidates`) return secondaryOAuthCandidates(request, env);
  if (url.pathname === `${ADMIN_PATH}/oauth/secondary/select`) return selectSecondaryFacebookPage(request, env);
  if (url.pathname === `${ADMIN_PATH}/facebook-collaboration`) return updateFacebookCollaboration(request, env);
  if (url.pathname === `${ADMIN_PATH}/preflight`) return preflight(env);
  if (url.pathname === `${ADMIN_PATH}/diagnostics`) return json(await metaDiagnostics(env));
  if (url.pathname === `${ADMIN_PATH}/pause`) {
    logMarketingSettings("marketing_admin_request", { action: "pause", method: request.method, path: url.pathname });
    return updateSettings(env, { enabled: 0 });
  }
  if (url.pathname === `${ADMIN_PATH}/resume`) {
    logMarketingSettings("marketing_admin_request", { action: "resume", method: request.method, path: url.pathname });
    return publishingDisabled(env) ? publishingDisabledResponse() : updateSettings(env, { enabled: 1 });
  }
  if (url.pathname === `${ADMIN_PATH}/schedule`) {
    const input = await readJson(request);
    const hour = Number(input?.hourUtc);
    const minute = Number(input?.minuteUtc);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59 || minute % 15 !== 0) {
      return json({ ok: false, error: "Choose a valid UTC hour and a 15-minute interval." }, 400);
    }
    return updateSettings(env, { schedule_hour_utc: hour, schedule_minute_utc: minute });
  }
  return json({ ok: false, error: "Marketing endpoint not found." }, 404);
}

export async function runMarketingSchedule(event, env) {
  if (publishingDisabled(env)) return { ok: true, skipped: "publishing-disabled" };
  if (!env.GIFT_CARD_DB) return { ok: false, skipped: "database-unavailable" };
  const settings = await getSettings(env);
  if (!settings || !settings.enabled) return { ok: true, skipped: "paused" };
  const now = new Date(event?.scheduledTime || Date.now());
  if (!isScheduledSlot(settings, now)) return { ok: true, skipped: "outside-schedule" };
  const slot = scheduleSlotKey(settings, now);
  if (settings.last_run_date === slot) return { ok: true, skipped: "already-posted-this-slot" };
  return runMarketingAutomation(env, { trigger: "scheduled", scheduledAt: now });
}

export async function runMarketingAutomation(env, options = {}) {
  if (publishingDisabled(env)) return { ok: false, status: "disabled", skipped: "publishing-disabled", error: "Publishing is disabled in this environment." };
  const db = env.GIFT_CARD_DB;
  const settings = await getSettings(env);

  if (!settings?.enabled && !options.allowWhilePaused) {
    return { ok: true, status: "paused", skipped: "paused" };
  }
  const product = await selectNextProduct(db, {
    respectCooldown: options.trigger === "scheduled",
    now: options.scheduledAt instanceof Date ? options.scheduledAt : new Date(),
  });
  if (!product) return { ok: false, skipped: "no-affiliate-eligible-product", error: "No affiliate-eligible product available." };

  const campaignCode = `bdw-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8)}`;
  const trackedUrl = campaignUrl(product.url, campaignCode);
  const caption = await generateCaption(env, product, trackedUrl, campaignCode);
  const postId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO marketing_posts
    (id, product_source, product_id, product_name, product_url, product_image, caption, campaign_code, status, trigger_type, attempt_count, scheduled_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, 0, ?, ?, ?)`)
    .bind(postId, product.source, product.id, product.name, trackedUrl, product.image, caption, campaignCode, options.trigger || "manual", now, now, now).run();

  const platforms = [];
  const facebookPageIds = configuredFacebookPageIds(env);
  const secondaryFacebookConfigured = Boolean(await storedSecondaryFacebookConnection(db));
  if (facebookPageIds.length || secondaryFacebookConfigured) platforms.push("facebook");
  if (configured(env.META_INSTAGRAM_USER_ID)) platforms.push("instagram");
  if (!platforms.length) {
    await finishPost(db, postId, "failed", "Meta credentials are not configured.", {});
    return { ok: false, postId, product: product.name, caption, error: "Meta credentials are not configured." };
  }

  const results = {};
  for (const platform of platforms) {
    if (platform === "facebook") {
      const facebookContext = await resolveFacebookPublishingContext(env, facebookPageIds);
      const connection = facebookContext.connection;
      const pageAccess = connection.ok ? facebookContext.pageAccess.map((entry) => ({ ...entry, connectionRole: "facebook_primary" })) : facebookPageIds.map((pageId) => ({ pageId, ok: false, error: connection.error, connectionRole: "facebook_primary", tokenSource: connection.source || "none" }));
      const secondary = await secondaryFacebookPublishingEntry(env);
      if (secondary) pageAccess.push(secondary);
      results.facebook = await publishFacebookPages(env, db, postId, pageAccess, product, platformCaption(caption, trackedUrl, "facebook"), platformCampaignUrl(trackedUrl, "facebook"), connection.source);
      continue;
    }
    const connection = await resolveMetaConnection(env, "instagram");
    if (!connection.ok) {
      await savePlatformResult(db, postId, platform, "failed", "", 0, connection.error);
      results.instagram = { ok: false, error: connection.error, attempts: 0, tokenSource: connection.source || "none", diagnostic: connection.diagnostic, rejections: [] };
      continue;
    }
    const instagramSelection = await selectInstagramProduct(db, product, {
      respectCooldown: options.trigger === "scheduled",
      now: options.scheduledAt instanceof Date ? options.scheduledAt : new Date(),
    });
    if (!instagramSelection.product) {
      const error = `Instagram skipped: no compatible publicly accessible JPG, JPEG or PNG product image was available. ${instagramSelection.rejections.length} image(s) rejected.`;
      await savePlatformResult(db, postId, platform, "failed", "", 0, error);
      results.instagram = { ok: false, skipped: true, error, attempts: 0, rejections: instagramSelection.rejections };
      continue;
    }
    const instagramProduct = instagramSelection.product;
    const instagramUrl = campaignUrl(instagramProduct.url, campaignCode, "instagram");
    const generatedInstagramCaption = instagramProduct.id === product.id
      ? caption
      : await generateCaption(env, instagramProduct, instagramUrl, campaignCode);
    const instagramCaption = instagramFeedCaption(generatedInstagramCaption);
    results.instagram = await publishWithRetry({ ...env, META_TOKEN_SOURCE: connection.source }, db, postId, platform, instagramProduct, instagramCaption, instagramUrl, connection.token);
    results.instagram.tokenSource = connection.source;
    results.instagram.product = { id: String(instagramProduct.id), name: instagramProduct.name };
    results.instagram.destinationUrl = instagramUrl;
    results.instagram.destinationStrategy = "link_in_bio";
    results.instagram.rejections = instagramSelection.rejections;
  }
  const succeeded = Object.values(results).filter((result) => result.ok).length;
  const hasPartialPlatform = Object.values(results).some((result) => result.status === "partial");
  const status = succeeded === platforms.length && !hasPartialPlatform ? "success" : succeeded ? "partial" : "failed";
  const error = Object.values(results).filter((result) => !result.ok).map((result) => result.error).join(" | ");
  await finishPost(db, postId, status, error, results);
  if (status !== "failed" && options.trigger === "scheduled") {
    const currentSettings = await getSettings(env);
    const scheduledAt = options.scheduledAt instanceof Date ? options.scheduledAt : new Date(now);
    await db.prepare("UPDATE marketing_settings SET last_run_date = ?, next_run_at = ?, updated_at = ? WHERE id = 'primary'")
      .bind(scheduleSlotKey(currentSettings, scheduledAt), nextRunAt(currentSettings, new Date(now)), now).run();
  }
  return { ok: status !== "failed", status, postId, product: product.name, caption, platforms: results };
}

export async function distributePreparedProduct(env, input) {
  if (publishingDisabled(env)) return { ok: false, status: "failed", error: "Publishing is disabled in this environment.", results: {} };
  const db = env.GIFT_CARD_DB;
  if (!db) return { ok: false, status: "failed", error: "Marketing database unavailable.", results: {} };
  const product = input.product;
  const channels = input.channels || [];
  const campaignCode = `bdw-manual-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8)}`;
  const trackedUrl = campaignUrl(product.url, campaignCode);
  const postId = crypto.randomUUID();
  const now = new Date().toISOString();
  const fallbackCaption = clean(product.description, 700);
  await db.prepare(`INSERT INTO marketing_posts
    (id, product_source, product_id, product_name, product_url, product_image, caption, campaign_code, status, trigger_type, attempt_count, scheduled_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing', 'ai-distribution', 0, ?, ?, ?)`)
    .bind(postId, product.source, product.id, product.name, trackedUrl, product.image, input.content.facebook || input.content.instagram || fallbackCaption, campaignCode, now, now, now).run();

  const results = {};
  if (channels.includes("facebook")) {
    const configuredPages = configuredFacebookPageIds(env);
    const requestedPages = input.pageIds?.length ? input.pageIds.filter((id) => configuredPages.includes(id)) : configuredPages;
    const secondaryConfigured = Boolean(await storedSecondaryFacebookConnection(db));
    if (!requestedPages.length && !secondaryConfigured) {
      results.facebook = { ok: false, status: "failed", error: "No configured Facebook Page was selected.", attempts: 0 };
      await savePlatformResult(db, postId, "facebook", "failed", "", 0, results.facebook.error);
    } else {
      const context = await resolveFacebookPublishingContext(env, requestedPages);
      const pageAccess = context.connection.ok ? context.pageAccess.map((entry) => ({ ...entry, connectionRole: "facebook_primary" })) : requestedPages.map((pageId) => ({ pageId, ok: false, error: context.connection.error, connectionRole: "facebook_primary", tokenSource: context.connection.source || "none" }));
      const secondary = await secondaryFacebookPublishingEntry(env);
      if (secondary && (!input.pageIds?.length || input.pageIds.includes(secondary.pageId))) pageAccess.push(secondary);
      results.facebook = await publishFacebookPages(env, db, postId, pageAccess, product, input.content.facebook || fallbackCaption, platformCampaignUrl(trackedUrl, "facebook"), context.connection.source);
    }
  }
  if (channels.includes("instagram")) {
    const connection = await resolveMetaConnection(env, "instagram");
    if (!connection.ok) {
      results.instagram = { ok: false, status: "failed", error: connection.error, attempts: 0 };
      await savePlatformResult(db, postId, "instagram", "failed", "", 0, connection.error);
    } else {
      const selection = await selectInstagramProduct(db, product);
      const destinationUrl = clean(input.instagramDestinationUrl || product.instagramDestinationUrl || "https://bingodogwash.com/shop", 1000);
      if (!selection.product) {
        const error = "Skipped — Instagram image unavailable.";
        await savePlatformResult(db, postId, "instagram", "skipped", "", 0, error);
        results.instagram = { ok: false, skipped: true, status: "skipped", error, attempts: 0, rejections: selection.rejections, destinationUrl, destinationStrategy: "link_in_bio" };
      } else {
        const instagramProduct = selection.product;
        const selectedCaption = String(instagramProduct.id) === String(product.id)
          ? input.content.instagram || fallbackCaption
          : `${instagramProduct.name}. ${clean(instagramProduct.description, 500)}`;
        results.instagram = await publishWithRetry({ ...env, META_TOKEN_SOURCE: connection.source }, db, postId, "instagram", instagramProduct, instagramFeedCaption(selectedCaption), destinationUrl, connection.token);
        results.instagram.product = { id: String(instagramProduct.id), name: instagramProduct.name };
        results.instagram.rejections = selection.rejections;
        results.instagram.destinationUrl = destinationUrl;
        results.instagram.destinationStrategy = "link_in_bio";
        results.instagram.shoppingTags = { supported: true, applied: false, reason: "Requires an eligible connected Meta product catalogue." };
        results.instagram.storyLinkSticker = { supported: false, destinationUrl, reason: "Reserved for a supported Instagram Stories publishing workflow." };
      }
    }
  }
  const succeeded = Object.values(results).filter((result) => result.ok).length;
  const status = succeeded === channels.length ? "success" : succeeded ? "partial" : "failed";
  const error = Object.entries(results).filter(([, result]) => !result.ok).map(([channel, result]) => `${channel}: ${result.error || "Distribution failed."}`).join(" | ");
  await finishPost(db, postId, status, error, results);
  return { ok: succeeded > 0, status, postId, product: product.name, results };
}

function successfulScheduledProductSql(productIdExpression = "etsy_products.id") {
  return `mp.product_source = 'etsy'
      AND mp.product_id = ${productIdExpression}
      AND mp.trigger_type = 'scheduled'
      AND mp.status IN ('success', 'partial')
      AND (
        COALESCE(mp.facebook_post_id, '') <> ''
        OR COALESCE(mp.instagram_post_id, '') <> ''
        OR EXISTS (
          SELECT 1 FROM marketing_platform_results mpr
          WHERE mpr.post_id = mp.id
            AND mpr.status = 'success'
            AND (mpr.platform = 'instagram' OR mpr.platform = 'facebook' OR mpr.platform LIKE 'facebook:%' OR mpr.platform LIKE 'facebook_secondary:%')
        )
      )`;
}

function etsyListingIdFromUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || !/(^|\.)etsy\.com$/i.test(url.hostname) || url.username || url.password) return "";
    return url.pathname.match(/\/listing\/(\d{1,20})(?:\/|$)/)?.[1] || "";
  } catch {
    return "";
  }
}

function canonicalEtsyAffiliateUrl(product) {
  const listingId = String(product?.external_listing_id || "").trim();
  const affiliateUrl = String(product?.affiliate_url || "").trim();
  if (!/^\d{1,20}$/.test(listingId)
    || product?.affiliate_review_status !== "approved"
    || product?.affiliate_verification_status !== "match"
    || product?.affiliate_provider !== ETSY_AFFILIATE_PROVIDER
    || product?.affiliate_program !== ETSY_AFFILIATE_PROGRAM
    || product?.affiliate_storefront !== ETSY_CONCORDIA_STOREFRONT
    || !product?.affiliate_reviewed_at
    || !product?.affiliate_reviewed_by
    || !product?.affiliate_verified_at
    || affiliateUrl !== String(product?.affiliate_verified_url || "").trim()
    || String(product?.affiliate_destination_listing_id || "").trim() !== listingId
    || etsyListingIdFromUrl(product?.original_listing_url || product?.listing_url) !== listingId
    || etsyListingIdFromUrl(product?.affiliate_final_url) !== listingId) return "";
  try {
    const url = new URL(affiliateUrl);
    if (url.protocol !== "https:" || url.hostname !== "click.linksynergy.com" || url.pathname !== "/deeplink" || url.username || url.password) return "";
    if (url.searchParams.get("id") !== RAKUTEN_AFFILIATE_ID || url.searchParams.get("mid") !== RAKUTEN_ETSY_ADVERTISER_MID) return "";
    if (etsyListingIdFromUrl(url.searchParams.get("murl")) !== listingId) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function etsyMarketingProductSelectionSql({ excludeCooldown = false, excludeMostRecent = false, limit = 100 } = {}) {
  const successfulProduct = successfulScheduledProductSql();
  const lastSuccessfulAt = `(SELECT MAX(mp.created_at) FROM marketing_posts mp WHERE ${successfulProduct})`;
  const boundedLimit = Math.max(1, Math.min(100, Number(limit) || 1));
  return `SELECT
      'etsy' AS source, id, COALESCE(NULLIF(display_title, ''), title) AS name,
      COALESCE(NULLIF(display_description, ''), description, '') AS description,
      price, currency, category, quantity AS stock, external_listing_id,
      listing_url, original_listing_url, affiliate_url, affiliate_verified_url,
      affiliate_final_url, affiliate_destination_listing_id, affiliate_review_status,
      affiliate_reviewed_at, affiliate_reviewed_by, affiliate_verification_status,
      affiliate_verified_at, affiliate_provider, affiliate_program, affiliate_storefront,
      affiliate_url AS url,
      primary_image AS image,
      ${lastSuccessfulAt} AS last_successful_at
    FROM etsy_products
    WHERE public_visibility = 1 AND admin_status = 'published'
      AND affiliate_review_status = 'approved' AND affiliate_verification_status = 'match'
      AND affiliate_provider = '${ETSY_AFFILIATE_PROVIDER}' AND affiliate_program = '${ETSY_AFFILIATE_PROGRAM}'
      AND affiliate_storefront = '${ETSY_CONCORDIA_STOREFRONT}'
      AND COALESCE(affiliate_url, '') <> '' AND affiliate_url = affiliate_verified_url
      AND COALESCE(affiliate_destination_listing_id, '') = external_listing_id
      AND COALESCE(affiliate_reviewed_at, '') <> '' AND COALESCE(affiliate_reviewed_by, '') <> ''
      AND COALESCE(affiliate_verified_at, '') <> '' AND COALESCE(affiliate_final_url, '') <> ''
      AND affiliate_url LIKE 'https://click.linksynergy.com/deeplink?%'
      AND COALESCE(quantity, 1) > 0 AND COALESCE(primary_image, '') <> ''
      ${excludeCooldown ? `AND NOT EXISTS (SELECT 1 FROM marketing_posts mp WHERE ${successfulProduct} AND mp.created_at > ?)` : ""}
      ${excludeMostRecent ? `AND etsy_products.id <> COALESCE((
        SELECT recent.product_id FROM marketing_posts recent
        WHERE recent.product_source = 'etsy'
          AND recent.trigger_type = 'scheduled'
          AND recent.status IN ('success', 'partial')
          AND (
            COALESCE(recent.facebook_post_id, '') <> ''
            OR COALESCE(recent.instagram_post_id, '') <> ''
            OR EXISTS (
              SELECT 1 FROM marketing_platform_results recent_result
              WHERE recent_result.post_id = recent.id
                AND recent_result.status = 'success'
                AND (recent_result.platform = 'instagram' OR recent_result.platform = 'facebook' OR recent_result.platform LIKE 'facebook:%' OR recent_result.platform LIKE 'facebook_secondary:%')
            )
          )
        ORDER BY recent.created_at DESC LIMIT 1
      ), '')` : ""}
    ORDER BY CASE WHEN ${lastSuccessfulAt} IS NULL THEN 0 ELSE 1 END,
      COALESCE(${lastSuccessfulAt}, ''), updated_at DESC LIMIT ${boundedLimit}`;
}

async function marketingProductCandidates(statement) {
  const first = typeof statement.first === "function" ? await statement.first() : null;
  if (first) return [first];
  if (typeof statement.all === "function") return (await statement.all())?.results || [];
  return [];
}

function firstCanonicalEtsyProduct(products) {
  for (const product of products || []) {
    const affiliateUrl = canonicalEtsyAffiliateUrl(product);
    if (affiliateUrl) return { ...product, url: affiliateUrl };
  }
  return null;
}

async function selectNextProduct(db, { respectCooldown = false, now = new Date() } = {}) {
  if (!respectCooldown) {
    return firstCanonicalEtsyProduct(await marketingProductCandidates(db.prepare(etsyMarketingProductSelectionSql())));
  }
  const cutoff = new Date(now.getTime() - PRODUCT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const availableStatement = db.prepare(etsyMarketingProductSelectionSql({ excludeCooldown: true }));
  const availableQuery = typeof availableStatement.bind === "function" ? availableStatement.bind(cutoff) : availableStatement;
  const available = firstCanonicalEtsyProduct(await marketingProductCandidates(availableQuery));
  if (available) {
    available.cooldownFallback = false;
    return available;
  }
  const fallback = firstCanonicalEtsyProduct(await marketingProductCandidates(db.prepare(etsyMarketingProductSelectionSql({ excludeMostRecent: true }))));
  if (fallback) fallback.cooldownFallback = true;
  return fallback || null;
}

async function selectInstagramProduct(db, preferredProduct, { respectCooldown = false, now = new Date() } = {}) {
  const candidates = [preferredProduct];
  try {
    const statement = db.prepare(etsyMarketingProductSelectionSql({ excludeCooldown: respectCooldown, limit: 100 }));
    const cutoff = new Date(now.getTime() - PRODUCT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const query = respectCooldown && typeof statement.bind === "function" ? statement.bind(cutoff) : statement;
    const rows = await query.all();
    for (const product of rows?.results || []) {
      if (!canonicalEtsyAffiliateUrl(product)) continue;
      if (!candidates.some((candidate) => String(candidate.id) === String(product.id))) candidates.push(product);
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "instagram_candidate_lookup_failed", error: clean(error?.message, 500), timestamp: new Date().toISOString() }));
  }

  const rejections = [];
  for (const product of candidates) {
    const validation = await validateInstagramImage(product.image);
    if (validation.ok) return { product, rejections };
    const rejection = {
      productId: String(product.id || ""),
      productName: clean(product.name, 200),
      imageUrl: clean(product.image, 1000),
      reason: validation.reason,
      timestamp: new Date().toISOString(),
    };
    rejections.push(rejection);
    console.error(JSON.stringify({ event: "instagram_image_rejected", ...rejection }));
  }
  return { product: null, rejections };
}

async function validateInstagramImage(image) {
  let url;
  try { url = new URL(absoluteImage(image)); } catch { return { ok: false, reason: "Invalid image URL." }; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "Image URL is not HTTP(S)." };
  if (url.username || url.password) return { ok: false, reason: "Authenticated image URLs are not supported." };
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".local")) return { ok: false, reason: "Local image URLs are not publicly accessible." };
  const pathname = url.pathname.toLowerCase();
  if (/\.(pdf|zip|svg|webp|gif|bmp|tiff?|avif)(?:$|[?#])/.test(pathname)) return { ok: false, reason: "Unsupported image file type." };
  if (/(^|\/)download(?:\/|$)/.test(pathname) || /[?&](download|attachment)=/i.test(url.search)) return { ok: false, reason: "Download URLs are not accepted by Instagram." };
  let response;
  try {
    response = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(5000) });
    if (!response.ok) response = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, redirect: "follow", signal: AbortSignal.timeout(5000) });
  } catch {
    return { ok: false, reason: "Image URL is not publicly accessible." };
  }
  if (!response.ok) return { ok: false, reason: `Image URL returned HTTP ${response.status}.` };
  const contentType = (response.headers.get("Content-Type") || "").split(";", 1)[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/png'].includes(contentType)) return { ok: false, reason: contentType ? `Unsupported Content-Type: ${contentType}.` : "Image response did not include a supported Content-Type." };
  return { ok: true, contentType };
}

function instagramFeedCaption(value) {
  const withoutUrls = String(value || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b(?:click|tap)\s+(?:on\s+)?(?:the\s+)?link\s+(?:below|above|here)\b[.!:]?/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const withoutFalseCta = withoutUrls.replace(/\bshop\s+now\s*[-—:]?\s*link\s+in\s+bio\s*🐾?/gi, "").trim();
  return `${withoutFalseCta}${withoutFalseCta ? "\n\n" : ""}Shop now — link in bio 🐾`;
}

async function storedMetaConnection(db) {
  if (!db) return null;
  try {
    return await db.prepare("SELECT page_access_token, page_token_expires_at, instagram_access_token, instagram_token_expires_at, updated_at FROM marketing_connections WHERE id = 'primary'").first();
  } catch {
    return null;
  }
}

async function resolveMetaConnection(env, platform, requiredSource = "") {
  const stored = await storedMetaConnection(env.GIFT_CARD_DB);
  const candidates = platform === "facebook"
    ? [{ source: "d1", value: stored?.page_access_token }, { source: "secret", value: env.META_PAGE_ACCESS_TOKEN }]
    : [{ source: "d1", value: stored?.instagram_access_token }, { source: "secret", value: env.INSTAGRAM_ACCESS_TOKEN }];
  const unique = [];
  for (const candidate of candidates) {
    if (requiredSource && candidate.source !== requiredSource) continue;
    const checked = metaAccessToken(candidate.value);
    if (checked.ok && !unique.some((item) => item.token === checked.token)) unique.push({ source: candidate.source, token: checked.token });
  }
  if (!unique.length) return { ok: false, source: "none", error: META_ERROR.missing, diagnostic: { requestStage: "before_graph_request", graphRequestMade: false } };

  let lastFailure = null;
  for (const candidate of unique) {
    try {
      let profile;
      let debug;
      if (platform === "facebook") {
        debug = await graphGet(FACEBOOK_GRAPH_ORIGIN, `${GRAPH_VERSION}/debug_token`, { input_token: candidate.token }, candidate.token, "facebook_token_debug", { accountId: configuredFacebookPageIds(env)[0] || "", tokenSource: candidate.source });
        if (debug?.data?.is_valid !== true) {
          lastFailure = { ok: false, source: candidate.source, error: FACEBOOK_TOKEN_EXPIRED, diagnostic: { operation: "facebook_token_debug", requestStage: "after_graph_response", graphRequestMade: true, tokenValid: false } };
          continue;
        }
      } else {
        profile = await graphGet(INSTAGRAM_GRAPH_ORIGIN, "me", { fields: "id,username,account_type" }, candidate.token, "instagram_identity", { accountId: env.META_INSTAGRAM_USER_ID || "", tokenSource: candidate.source });
        if (String(profile.id || "") !== String(env.META_INSTAGRAM_USER_ID || "")) {
          lastFailure = { ok: false, source: candidate.source, error: "Instagram token belongs to a different account.", diagnostic: { operation: "instagram_identity", requestStage: "after_graph_response", graphRequestMade: true, accountId: String(env.META_INSTAGRAM_USER_ID || "") } };
          continue;
        }
      }
      return { ok: true, source: candidate.source, token: candidate.token, profile: platform === "instagram" ? profile : undefined, debug: platform === "facebook" ? debug?.data || {} : undefined };
    } catch (error) {
      lastFailure = { ok: false, source: candidate.source, error: safeMetaError(error), diagnostic: error?.diagnostic || null };
    }
  }
  return lastFailure || { ok: false, source: "none", error: META_ERROR.invalid };
}

async function resolveFacebookPublishingContext(env, pageIds) {
  const stored = await resolveMetaConnection(env, "facebook", "d1");
  const storedType = String(stored.debug?.type || "").toUpperCase();
  if (stored.ok && storedType === "USER") {
    return resolveFacebookUserPublishingContext(env, pageIds, stored, "d1/meta_oauth", storedType);
  }

  const secret = await resolveMetaConnection(env, "facebook", "secret");
  const secretType = String(secret.debug?.type || "").toUpperCase();
  if (secret.ok && secretType === "USER") {
    return resolveFacebookUserPublishingContext(env, pageIds, secret, "secret", storedType || "none");
  }

  // PAGE tokens are fallback-only: they represent exactly one Page and must never
  // be used for /me/accounts discovery or reused across configured Pages.
  const fallback = secret.ok && secretType === "PAGE"
    ? { credential: secret, source: "secret" }
    : stored.ok && storedType === "PAGE"
      ? { credential: stored, source: "d1" }
      : null;
  const singlePageMode = pageIds.length === 1;
  if (!fallback) return { connection: stored.ok ? stored : secret, pageAccess: [], accountsRequest: { ok: false, attempted: false }, userCredentialSource: "none", d1CredentialType: storedType || "unknown", singlePageMode, multiPageModeAvailable: false, fallbackPageTokenUsed: false, statusMessage: singlePageMode ? `Single-Page mode unavailable — Facebook Page ${pageIds[0]}` : "Multi-Page mode unavailable" };
  const resolved = await resolveFacebookPageTokenAccess(fallback.credential.token, pageIds, fallback.source);
  return { connection: fallback.credential, ...resolved, userCredentialSource: "none", d1CredentialType: storedType || "none", singlePageMode, multiPageModeAvailable: false, fallbackPageTokenUsed: true, statusMessage: singlePageMode ? `Single-Page fallback active — Facebook Page ${pageIds[0]}` : "Page-token fallback active" };
}

async function resolveFacebookUserPublishingContext(env, pageIds, userCredential, userCredentialSource, d1CredentialType) {
  const discovered = await resolveFacebookPageAccess(userCredential.token, pageIds, userCredentialSource, true);
  const fallbackSources = userCredential.source === "d1" ? ["secret"] : ["d1"];
  let fallbackPageTokenUsed = false;
  let fallbackPageTokenSource = "none";
  let pageAccess = discovered.pageAccess;

  if (pageAccess.some((entry) => !entry.ok)) {
    for (const source of fallbackSources) {
      const candidate = await resolveMetaConnection(env, "facebook", source);
      if (!candidate.ok || String(candidate.debug?.type || "").toUpperCase() !== "PAGE") continue;
      const fallback = await resolveFacebookPageTokenAccess(candidate.token, pageIds, source);
      const fallbackById = new Map(fallback.pageAccess.filter((entry) => entry.ok).map((entry) => [entry.pageId, entry]));
      pageAccess = pageAccess.map((entry) => entry.ok || !fallbackById.has(entry.pageId) ? entry : fallbackById.get(entry.pageId));
      fallbackPageTokenUsed = fallbackById.size > 0;
      fallbackPageTokenSource = fallbackPageTokenUsed ? source : "none";
      if (fallbackPageTokenUsed) break;
    }
  }

  return {
    connection: userCredential,
    pageAccess,
    accountsRequest: discovered.accountsRequest,
    userCredentialSource,
    d1CredentialType,
    singlePageMode: false,
    multiPageModeAvailable: true,
    fallbackPageTokenUsed,
    fallbackPageTokenSource,
    statusMessage: fallbackPageTokenUsed ? "User credential discovery active with Page-token fallback" : "User credential discovery active",
  };
}

async function resolveFacebookPageAccess(token, pageIds, tokenSource = "unknown", includeContext = false) {
  const accessible = new Map();
  let accountsRequest;
  try {
    const accounts = await graphGet(FACEBOOK_GRAPH_ORIGIN, `${GRAPH_VERSION}/me/accounts`, { fields: "id,name,access_token,tasks", limit: "100" }, token, "facebook_accounts", { tokenSource });
    const returnedPages = [];
    for (const page of accounts?.data || []) {
      const checked = metaAccessToken(page?.access_token);
      const tasks = Array.isArray(page?.tasks) ? page.tasks.map((task) => clean(task, 80)).filter(Boolean) : [];
      if (checked.ok) accessible.set(String(page.id), { token: checked.token, name: clean(page?.name, 160), tasks });
      returnedPages.push({
        id: String(page?.id || ""),
        name: clean(page?.name, 160),
        pageAccessTokenAvailable: checked.ok,
        tasks,
      });
    }
    accountsRequest = {
      ok: true,
      attempted: true,
      returnedPageCount: returnedPages.length,
      returnedPageIds: returnedPages.map((page) => page.id).filter(Boolean),
      returnedPageNames: returnedPages.map((page) => page.name).filter(Boolean),
      pages: returnedPages,
    };
  } catch (error) {
    accountsRequest = { ok: false, attempted: true, error: safeMetaError(error), diagnostic: error?.diagnostic || null };
    console.error(JSON.stringify({ event: "meta_page_discovery_failed", operation: "facebook_accounts", tokenSource, error: accountsRequest.error, diagnostic: accountsRequest.diagnostic }));
  }

  const pageAccess = pageIds.map((pageId) => accessible.has(pageId)
    ? { ok: true, pageId, token: accessible.get(pageId).token, name: accessible.get(pageId).name, tasks: accessible.get(pageId).tasks, pageAccessTokenAvailable: true, returnedByAccounts: true, tokenSource: `${tokenSource}:me/accounts` }
    : { ok: false, pageId, returnedByAccounts: false, tokenSource: "none", classification: "not_managed_page_or_profile", possibleProfileId: true, error: "Configured ID was not returned by /me/accounts; it may be a Facebook profile ID or a Page this user does not manage.", diagnostic: accountsRequest?.diagnostic || null });
  return includeContext ? { pageAccess, accountsRequest } : pageAccess;
}

async function resolveFacebookPageTokenAccess(token, pageIds, tokenSource) {
  let tokenPageId = "";
  let diagnostic = null;
  try {
    const page = await graphGet(FACEBOOK_GRAPH_ORIGIN, `${GRAPH_VERSION}/me`, { fields: "id,name" }, token, "facebook_page_identity", { tokenSource });
    tokenPageId = String(page?.id || "");
  } catch (error) {
    diagnostic = error?.diagnostic || null;
  }
  const pageAccess = pageIds.map((pageId) => pageId === tokenPageId
    ? { ok: true, pageId, token, returnedByAccounts: false, tokenSource: `${tokenSource}:page_token` }
    : { ok: false, pageId, returnedByAccounts: false, tokenSource: "none", classification: "not_available_to_page_token", possibleProfileId: true, error: "Configured ID is not the Page represented by the fallback Page token; it may be a Facebook profile ID or an unmanaged Page.", diagnostic });
  return { pageAccess, accountsRequest: { ok: false, attempted: false, reason: "Fallback credential is a Page token; /me/accounts was not called." } };
}

async function generateCaption(env, product, url, campaignCode) {
  if (env.AI?.run) {
    try {
      const response = await env.AI.run(env.MARKETING_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct-fp8-fast", {
        messages: [
          { role: "system", content: "Write one friendly UK social caption for Bingo Dog Wash. Include the exact product name, a truthful benefit, dog wording, suitable emojis, a call to action, the exact URL, and 3-5 hashtags. Never invent claims or discounts. Return only the caption." },
          { role: "user", content: JSON.stringify({ name: product.name, description: product.description, category: product.category, price: priceLabel(product), url }) }
        ],
        max_tokens: 260,
        temperature: 0.9
      });
      const text = clean(response?.response || response?.result?.response, 2200);
      if (text.includes(product.name) && text.includes(url)) return text;
    } catch (error) {
      console.error(JSON.stringify({ level: "warn", message: "Marketing AI caption fallback", error: clean(error?.message, 300) }));
    }
  }
  const variants = [
    [`🐶 Product of the Day: ${product.name}!`, `Give your four-legged friend ${benefit(product)}.`, "Treat your dog today:"],
    [`🐾 Today's tail-wagging pick is ${product.name}.`, `${benefit(product)} — chosen with happy dogs and their humans in mind.`, "Take a closer look:"],
    [`Fresh pick for dog lovers! 🦴 ${product.name}`, `A handy choice for ${benefit(product)}.`, "Shop the product:"],
    [`Make tails wag with ${product.name} ✨`, `${benefit(product)}, from the Bingo Dog Wash shop.`, "Fetch yours here:"]
  ];
  const index = hash(`${campaignCode}:${product.id}`) % variants.length;
  return `${variants[index].join("\n\n")}\n${url}\n\n#BingoDogWash #DogLovers #PetCare #DogsOfInstagram`;
}

async function publishWithRetry(env, db, postId, platform, product, caption, url, token) {
  let lastError = "Unknown publishing error.";
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const externalPostId = platform.startsWith("facebook")
        ? await publishFacebook(env, product.image, caption, url, token)
        : await publishInstagram(env, product.image, caption, token);
      await savePlatformResult(db, postId, platform, "success", externalPostId, attempt, "", env.META_DESTINATION_METADATA);
      return { ok: true, id: externalPostId, attempts: attempt };
    } catch (error) {
      lastError = clean(error?.message || error, 500);
      const retryable = error?.retryable !== false;
      await savePlatformResult(db, postId, platform, !retryable || attempt === MAX_RETRIES ? "failed" : "retrying", "", attempt, lastError, env.META_DESTINATION_METADATA);
      if (!retryable) return { ok: false, error: lastError, attempts: attempt, diagnostic: error?.diagnostic || null };
    }
  }
  return { ok: false, error: lastError, attempts: MAX_RETRIES };
}

async function publishFacebookPages(env, db, postId, pageAccess, product, caption, url, tokenSource = "unknown") {
  const pages = {};
  for (const entry of pageAccess) {
    const { pageId } = entry;
    const connectionRole = entry.connectionRole === "facebook_secondary" ? "facebook_secondary" : "facebook_primary";
    const platformKey = connectionRole === "facebook_secondary" ? `facebook_secondary:${pageId}` : `facebook:${pageId}`;
    const metadata = { connectionRole, pageId, pageName: clean(entry.name, 200) };
    if (!entry.ok) {
      pages[pageId] = { ok: false, error: entry.error, attempts: 0, diagnostic: entry.diagnostic, tokenSource: entry.tokenSource || "none", returnedByAccounts: entry.returnedByAccounts === true, classification: entry.classification || "" };
      await savePlatformResult(db, postId, platformKey, "failed", "", 0, entry.error, metadata);
    } else {
      pages[pageId] = { ...await publishWithRetry({ ...env, META_PAGE_ID: pageId, META_TOKEN_SOURCE: entry.tokenSource || tokenSource, META_DESTINATION_METADATA: metadata }, db, postId, platformKey, product, caption, url, entry.token), tokenSource: entry.tokenSource || tokenSource, returnedByAccounts: entry.returnedByAccounts === true, connectionRole };
    }
    console.error(JSON.stringify({
      event: "facebook_page_publish_result",
      pageId,
      connectionRole,
      success: pages[pageId].ok,
      facebookPostId: pages[pageId].id || "",
      error: pages[pageId].error || "",
      timestamp: new Date().toISOString(),
    }));
  }
  const pageIds = pageAccess.map((entry) => entry.pageId);
  const succeeded = Object.values(pages).filter((result) => result.ok).length;
  const failedPages = Object.entries(pages).filter(([, result]) => !result.ok).map(([pageId]) => pageId);
  return {
    ok: succeeded > 0,
    status: succeeded === pageIds.length ? "success" : succeeded ? "partial" : "failed",
    pages,
    succeededPages: Object.entries(pages).filter(([, result]) => result.ok).map(([pageId]) => pageId),
    failedPages,
    tokenSource,
    id: pageIds.length === 1 ? pages[pageIds[0]]?.id || "" : "",
    attempts: Math.max(...Object.values(pages).map((result) => result.attempts || 0), 0),
    error: failedPages.map((pageId) => `${pageId}: ${pages[pageId].error}`).join(" | "),
  };
}

async function publishFacebook(env, image, caption, link, token) {
  const body = new URLSearchParams({ url: absoluteImage(image), caption: `${caption}\n\n${link}`, access_token: token });
  return graphPost(FACEBOOK_GRAPH_ORIGIN, `${GRAPH_VERSION}/${env.META_PAGE_ID}/photos`, body, "facebook_photo_upload", { accountId: String(env.META_PAGE_ID || ""), tokenSource: env.META_TOKEN_SOURCE || "unknown" });
}

async function publishInstagram(env, image, caption, token) {
  const context = { accountId: String(env.META_INSTAGRAM_USER_ID || ""), tokenSource: env.META_TOKEN_SOURCE || "unknown" };
  const create = await graphPost(INSTAGRAM_GRAPH_ORIGIN, `${env.META_INSTAGRAM_USER_ID}/media`, new URLSearchParams({ image_url: absoluteImage(image), caption, access_token: token }), "media_create", context);
  await waitForInstagramMedia(env, create, token, context);
  const configuredDelay = Number(env.INSTAGRAM_MEDIA_STATUS_DELAY_MS);
  const retryDelayMs = Number.isFinite(configuredDelay) ? Math.min(10000, Math.max(0, Math.trunc(configuredDelay))) : 1500;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await graphPost(INSTAGRAM_GRAPH_ORIGIN, `${env.META_INSTAGRAM_USER_ID}/media_publish`, new URLSearchParams({ creation_id: create, access_token: token }), "media_publish", context);
    } catch (error) {
      const mediaIdPending = /media id is not available/i.test(String(error?.message || ""));
      if (!mediaIdPending || attempt === 3) throw error;
      if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      await waitForInstagramMedia({ ...env, INSTAGRAM_MEDIA_STATUS_DELAY_MS: 0 }, create, token, context);
    }
  }
  throw new Error("Instagram publishing failed.");
}

async function waitForInstagramMedia(env, creationId, token, context) {
  const configuredAttempts = Number(env.INSTAGRAM_MEDIA_STATUS_ATTEMPTS);
  const configuredDelay = Number(env.INSTAGRAM_MEDIA_STATUS_DELAY_MS);
  const attempts = Number.isFinite(configuredAttempts) ? Math.min(20, Math.max(1, Math.trunc(configuredAttempts))) : 10;
  const delayMs = Number.isFinite(configuredDelay) ? Math.min(10000, Math.max(0, Math.trunc(configuredDelay))) : 1500;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const media = await graphGet(INSTAGRAM_GRAPH_ORIGIN, creationId, { fields: "status_code,status" }, token, "media_status", context);
    const statusCode = String(media?.status_code || "").trim().toUpperCase();
    if (statusCode === "FINISHED" || statusCode === "PUBLISHED") return;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      const diagnostic = { ...metaDiagnostic("media_status", 200, null, "media_processing_failed", context, "after_graph_response", INSTAGRAM_GRAPH_ORIGIN, creationId), mediaStatusCode: statusCode };
      logMetaDiagnostic(diagnostic);
      throw publishingError(`Instagram media processing ${statusCode.toLowerCase()}.`, false, diagnostic);
    }
    if (attempt < attempts && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const diagnostic = { ...metaDiagnostic("media_status", 200, null, "media_processing_timeout", context, "after_graph_response", INSTAGRAM_GRAPH_ORIGIN, creationId), mediaStatusCode: "IN_PROGRESS" };
  logMetaDiagnostic(diagnostic);
  throw publishingError("Instagram media is still processing. Try again shortly.", true, diagnostic);
}

async function graphPost(origin, path, body, operation = "", context = {}) {
  const endpoint = `${origin}/${path}`;
  let response;
  try {
    response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${body.get("access_token") || ""}` }, body });
  } catch (error) {
    const diagnostic = metaDiagnostic(operation, null, null, networkCategory(error), context, "graph_request_failed", origin, path);
    logMetaDiagnostic(diagnostic);
    throw publishingError(META_ERROR.network, true, diagnostic);
  }
  let data = null;
  let nonJson = false;
  try { data = await response.json(); } catch { nonJson = true; }
  if (!response.ok || !data?.id) {
    const diagnostic = metaDiagnostic(operation, response.status, data, nonJson ? "non_json" : response.ok ? "malformed_response" : "provider_error", context, "after_graph_response", origin, path);
    logMetaDiagnostic(diagnostic);
    throw publishingError(metaApiError(data, response.status), response.status === 429 || response.status >= 500, diagnostic);
  }
  return data.id;
}

async function preflight(env) {
  const settings = await getSettings(env);
  if (settings?.enabled) return json({ ok: false, error: "Pause automation before running preflight.", paused: false }, 409);
  const instagram = await instagramPreflight(env);
  const facebookPrimary = await facebookPreflight(env);
  const facebookSecondary = await secondaryFacebookPreflight(env);
  const secondaryHealthy = !facebookSecondary.connected || facebookSecondary.ok === true;
  const ok = instagram.ok && facebookPrimary.ok && secondaryHealthy;
  return json({ ok, paused: true, publishingAttempted: false, instagram, facebook: facebookPrimary, facebookPrimary, facebookSecondary }, ok ? 200 : 422);
}

async function instagramPreflight(env) {
  const stored = await storedMetaConnection(env.GIFT_CARD_DB);
  const configuredToken = metaAccessToken(stored?.instagram_access_token || env.INSTAGRAM_ACCESS_TOKEN);
  if (!configuredToken.ok) return { ok: false, error: configuredToken.error, api: "Instagram Login" };
  if (!configured(env.META_INSTAGRAM_USER_ID) || !configured(env.META_INSTAGRAM_USERNAME)) {
    logMetaValidation("instagram_token_check", {
      missingConfig: !configured(env.META_INSTAGRAM_USER_ID) ? "META_INSTAGRAM_USER_ID" : "META_INSTAGRAM_USERNAME",
      validationError: META_ERROR.incomplete,
    });
    return { ok: false, error: META_ERROR.incomplete, api: "Instagram Login" };
  }
  const connection = await resolveMetaConnection(env, "instagram");
  if (!connection.ok) return { ok: false, authenticationOk: false, error: connection.error, api: "Instagram Login", failedCheck: "profile-authentication", tokenSource: connection.source, diagnostic: connection.diagnostic };
  const profile = connection.profile || {};
  if (String(profile.id) !== String(env.META_INSTAGRAM_USER_ID) || String(profile.username).toLowerCase() !== String(env.META_INSTAGRAM_USERNAME).toLowerCase()) {
    return { ok: false, authenticationOk: true, identityOk: false, error: META_ERROR.incomplete, api: "Instagram Login" };
  }
  const accountType = String(profile.account_type || "").toUpperCase();
  if (!["BUSINESS", "CREATOR", "MEDIA_CREATOR"].includes(accountType)) {
    return { ok: false, authenticationOk: true, identityOk: false, error: META_ERROR.incomplete, api: "Instagram Login" };
  }
  return {
    ok: true,
    authenticationOk: true,
    identityOk: true,
    api: "Instagram Login",
    id: String(profile.id),
    username: profile.username,
    accountType: profile.account_type,
    publishingPermission: "identity-verified",
    tokenSource: connection.source,
  };
}

async function validateFacebookToken(env, token) {
  const tokenCheck = metaAccessToken(token);
  const pageId = configuredFacebookPageIds(env)[0] || "";
  if (!tokenCheck.ok) {
    logMetaValidation("facebook_token_check", {
      missingConfig: !configured(env.META_PAGE_ACCESS_TOKEN) ? "META_PAGE_ACCESS_TOKEN" : (!pageId ? "META_PAGE_ID or META_PAGE_IDS" : null),
      validationError: tokenCheck.error,
    });
    return {
      ok: false,
      pageId,
      permissions: [],
      tokenStatus: { valid: false },
      error: tokenCheck.error === META_ERROR.invalid ? FACEBOOK_TOKEN_EXPIRED : tokenCheck.error,
      api: "Facebook Pages"
    };
  }
  if (!pageId) {
    logMetaValidation("facebook_token_check", {
      missingConfig: "META_PAGE_ID",
      validationError: META_ERROR.incomplete,
    });
    return { ok: false, pageId, permissions: [], tokenStatus: { valid: false }, error: META_ERROR.incomplete, api: "Facebook Pages" };
  }

  let debug;
  try {
    debug = await graphGet(FACEBOOK_GRAPH_ORIGIN, `${GRAPH_VERSION}/debug_token`, { input_token: tokenCheck.token }, tokenCheck.token, "token_debug");
  } catch (error) {
    const message = safeMetaError(error);
    logMetaValidation("facebook_token_debug", {
      validationError: message,
      apiErrorCode: Number(error?.message && error.message.match(/\d+/)?.[0]) || null,
      apiErrorMessage: message,
    });
    return { ok: false, pageId, permissions: [], tokenStatus: { valid: false }, error: message === META_ERROR.invalid ? FACEBOOK_TOKEN_EXPIRED : message, api: "Facebook Pages" };
  }

  const debugData = debug?.data || {};
  const permissions = Array.isArray(debugData.scopes) ? debugData.scopes : [];
  const tokenStatus = {
    valid: debugData.is_valid === true,
    appId: clean(debugData.app_id, 80),
    application: clean(debugData.application, 120),
    type: clean(debugData.type, 40),
    expiresAt: Number.isFinite(debugData.expires_at) ? new Date(debugData.expires_at * 1000).toISOString() : "",
  };
  if (!tokenStatus.valid) {
    return { ok: false, pageId, permissions, tokenStatus, error: FACEBOOK_TOKEN_EXPIRED, api: "Facebook Pages" };
  }
  if (configured(env.META_APP_ID) && String(env.META_APP_ID) !== String(debugData.app_id)) {
    return {
      ok: false,
      pageId,
      permissions,
      tokenStatus,
      error: "Facebook token belongs to an unexpected app. Reconnect Meta account.",
      api: "Facebook Pages"
    };
  }
  return { ok: true, pageId, permissions, tokenStatus, token: tokenCheck.token };
}

async function facebookPreflight(env) {
  const pageIds = configuredFacebookPageIds(env);
  const pageId = pageIds[0] || "";
  const facebookContext = await resolveFacebookPublishingContext(env, pageIds);
  const connection = facebookContext.connection;
  if (!connection.ok) return { ok: false, pageId, pageIds, permissions: [], tokenStatus: { valid: false }, error: connection.error, api: "Facebook Pages", tokenSource: connection.source, diagnostic: connection.diagnostic };
  const permissions = Array.isArray(connection.debug?.scopes) ? connection.debug.scopes : [];
  const tokenStatus = {
    valid: connection.debug?.is_valid === true,
    appId: clean(connection.debug?.app_id, 80),
    application: clean(connection.debug?.application, 120),
    type: clean(connection.debug?.type, 40),
    expiresAt: Number.isFinite(connection.debug?.expires_at) ? new Date(connection.debug.expires_at * 1000).toISOString() : "",
  };
  const requiredPermissions = facebookContext.singlePageMode ? ["pages_manage_posts"] : FACEBOOK_REQUIRED_SCOPES;
  const missingPermissions = requiredPermissions.filter((scope) => !permissions.includes(scope));
  if (missingPermissions.length > 0) {
    return {
      ok: false,
      pageId,
      permissions,
      tokenStatus,
      missingPermissions,
      error: "Facebook connection does not have required page permissions.",
      api: "Facebook Pages"
    };
  }
  const pageAccess = facebookContext.pageAccess;
  const pages = Object.fromEntries(pageAccess.map((entry) => [entry.pageId, {
    ok: entry.ok,
    name: entry.name || "",
    tasks: Array.isArray(entry.tasks) ? entry.tasks : [],
    pageAccessTokenAvailable: entry.pageAccessTokenAvailable === true,
    returnedByAccounts: entry.returnedByAccounts === true,
    tokenSource: entry.tokenSource || "none",
    classification: entry.classification || "",
    possibleProfileId: entry.possibleProfileId === true,
    error: entry.error || "",
    diagnostic: entry.diagnostic || null,
  }]));
  const accessiblePageIds = pageAccess.filter((entry) => entry.ok).map((entry) => entry.pageId);
  return { ok: accessiblePageIds.length > 0, pageId, pageIds, accessiblePageIds, pages, permissions, requiredPermissions, tokenStatus, tokenSource: connection.source, userCredentialSource: facebookContext.userCredentialSource, accountsRequest: facebookContext.accountsRequest, d1CredentialType: facebookContext.d1CredentialType, singlePageMode: facebookContext.singlePageMode === true, multiPageModeAvailable: facebookContext.multiPageModeAvailable === true, fallbackPageTokenUsed: facebookContext.fallbackPageTokenUsed === true, fallbackPageTokenSource: facebookContext.fallbackPageTokenSource || "none", statusMessage: facebookContext.statusMessage || "", api: "Facebook Pages", id: accessiblePageIds[0] || "", error: accessiblePageIds.length ? "" : "No configured Facebook Pages are accessible with the selected credential." };
}

async function metaDiagnostics(env) {
  const [facebookContext, instagram, stored] = await Promise.all([
    resolveFacebookPublishingContext(env, configuredFacebookPageIds(env)),
    resolveMetaConnection(env, "instagram"),
    storedMetaConnection(env.GIFT_CARD_DB),
  ]);
  const facebook = facebookContext.connection;
  return {
    facebook: {
      secretConfigured: configured(env.META_PAGE_ACCESS_TOKEN),
      storedTokenConfigured: configured(stored?.page_access_token),
      pageIdConfigured: configuredFacebookPageIds(env).length > 0,
      pageIds: configuredFacebookPageIds(env),
      tokenValidated: facebook.ok,
      tokenSource: facebook.source || "none",
      singlePageMode: facebookContext.singlePageMode === true,
      multiPageModeAvailable: facebookContext.multiPageModeAvailable === true,
      fallbackPageTokenUsed: facebookContext.fallbackPageTokenUsed === true,
      fallbackPageTokenSource: facebookContext.fallbackPageTokenSource || "none",
      statusMessage: facebookContext.statusMessage || "",
      userCredentialSource: facebookContext.userCredentialSource || "none",
      d1CredentialType: facebookContext.d1CredentialType || "unknown",
      accountsRequest: facebookContext.accountsRequest || { ok: false, attempted: false },
      pages: Object.fromEntries((facebookContext.pageAccess || []).map((entry) => [entry.pageId, { ok: entry.ok, name: entry.name || "", tasks: Array.isArray(entry.tasks) ? entry.tasks : [], pageAccessTokenAvailable: entry.pageAccessTokenAvailable === true, returnedByAccounts: entry.returnedByAccounts === true, tokenSource: entry.tokenSource || "none", classification: entry.classification || "", possibleProfileId: entry.possibleProfileId === true, error: entry.error || "" }])),
      validationError: facebook.ok ? "" : facebook.error,
      diagnostic: facebook.diagnostic || null,
      debug: facebook.ok ? { tokenStatus: { valid: facebook.debug?.is_valid === true }, appId: clean(facebook.debug?.app_id, 80), type: clean(facebook.debug?.type, 40), expiresAt: Number.isFinite(facebook.debug?.expires_at) ? new Date(facebook.debug.expires_at * 1000).toISOString() : "" } : undefined,
    },
    instagram: {
      secretConfigured: configured(env.INSTAGRAM_ACCESS_TOKEN),
      storedTokenConfigured: configured(stored?.instagram_access_token),
      userIdConfigured: configured(env.META_INSTAGRAM_USER_ID),
      tokenValidated: instagram.ok,
      tokenSource: instagram.source || "none",
      validationError: instagram.ok ? "" : instagram.error,
      diagnostic: instagram.diagnostic || null,
      profile: instagram.ok ? { id: String(instagram.profile?.id || ""), username: String(instagram.profile?.username || ""), accountType: String(instagram.profile?.account_type || "") } : undefined,
    },
  };
}

async function storedSecondaryFacebookConnection(db) {
  if (!db) return null;
  const row = await db.prepare("SELECT * FROM marketing_facebook_connections WHERE role = 'facebook_secondary' LIMIT 1").first();
  return row?.role === "facebook_secondary" && row.page_id && row.page_access_token ? row : null;
}

function secondaryConnectionPublic(row, extra = {}) {
  if (!row) return { connected: false, role: "facebook_secondary", pageId: "", pageName: "", tokenPresent: false, ...extra };
  let tasks = [];
  try { tasks = JSON.parse(row.tasks || "[]"); } catch { tasks = []; }
  return {
    connected: true,
    role: "facebook_secondary",
    pageId: String(row.page_id || ""),
    pageName: clean(row.page_name, 200),
    tokenPresent: configured(row.page_access_token),
    tokenType: clean(row.token_type, 40) || "PAGE",
    tokenExpiresAt: row.token_expires_at || "",
    tasks,
    latestHealthStatus: clean(row.latest_health_status, 40) || "unknown",
    latestError: safeStoredMetaError(row.latest_error),
    ...extra,
  };
}

async function secondaryOAuthCandidates(request, env) {
  const input = await readJson(request);
  const flowId = clean(input?.flowId, 100);
  if (!flowId) return json({ ok: false, error: "Secondary Facebook selection has expired. Start again." }, 400);
  const rows = await env.GIFT_CARD_DB.prepare("SELECT page_id, page_name, tasks, expires_at FROM marketing_facebook_oauth_pages WHERE flow_id = ? AND expires_at > ? ORDER BY page_name, page_id").bind(flowId, new Date().toISOString()).all();
  const pages = (rows.results || []).map((row) => {
    let tasks = [];
    try { tasks = JSON.parse(row.tasks || "[]"); } catch { tasks = []; }
    return { pageId: String(row.page_id), pageName: clean(row.page_name, 200), tasks, pageAccessTokenAvailable: true };
  });
  return json({ ok: true, flowId, pages });
}

async function selectSecondaryFacebookPage(request, env) {
  const input = await readJson(request);
  const flowId = clean(input?.flowId, 100);
  const pageId = clean(input?.pageId, 80);
  if (!flowId || !/^\d+$/.test(pageId)) return json({ ok: false, error: "Choose a Facebook Page returned by Meta." }, 400);
  if (configuredFacebookPageIds(env).includes(pageId)) return json({ ok: false, error: "Already connected as Facebook Primary." }, 409);
  const row = await env.GIFT_CARD_DB.prepare("SELECT * FROM marketing_facebook_oauth_pages WHERE flow_id = ? AND page_id = ? AND expires_at > ? LIMIT 1").bind(flowId, pageId, new Date().toISOString()).first();
  if (!row) return json({ ok: false, error: "That Page was not returned by this Meta connection or the selection expired." }, 400);
  let debug;
  let identity;
  try {
    [debug, identity] = await Promise.all([
      graphGet(FACEBOOK_GRAPH_ORIGIN, `${GRAPH_VERSION}/debug_token`, { input_token: row.page_access_token }, row.page_access_token, "secondary_facebook_token_debug", { accountId: pageId, tokenSource: "d1:facebook_secondary" }),
      graphGet(FACEBOOK_GRAPH_ORIGIN, `${GRAPH_VERSION}/me`, { fields: "id,name" }, row.page_access_token, "secondary_facebook_identity", { accountId: pageId, tokenSource: "d1:facebook_secondary" }),
    ]);
  } catch (error) {
    return json({ ok: false, error: safeMetaError(error), pageId }, 422);
  }
  const tokenData = debug?.data || {};
  const scopes = Array.isArray(tokenData.scopes) ? tokenData.scopes : [];
  if (tokenData.is_valid !== true || String(tokenData.type || "").toUpperCase() !== "PAGE" || String(identity?.id || "") !== pageId) {
    return json({ ok: false, error: "Meta did not validate this selection as the returned Facebook Page.", pageId }, 422);
  }
  const missingPermissions = ["pages_manage_posts"].filter((permission) => !scopes.includes(permission));
  if (missingPermissions.length) return json({ ok: false, error: "Facebook Page token is missing pages_manage_posts.", pageId, missingPermissions }, 422);
  const now = new Date().toISOString();
  const expiresAt = Number.isFinite(tokenData.expires_at) && tokenData.expires_at > 0 ? new Date(tokenData.expires_at * 1000).toISOString() : "";
  await env.GIFT_CARD_DB.prepare(`INSERT INTO marketing_facebook_connections (role, page_id, page_name, page_access_token, token_expires_at, token_type, tasks, latest_health_status, latest_error, created_at, updated_at)
    VALUES ('facebook_secondary', ?, ?, ?, ?, 'PAGE', ?, 'healthy', '', ?, ?)
    ON CONFLICT(role) DO UPDATE SET page_id=excluded.page_id, page_name=excluded.page_name, page_access_token=excluded.page_access_token, token_expires_at=excluded.token_expires_at, token_type=excluded.token_type, tasks=excluded.tasks, latest_health_status='healthy', latest_error='', updated_at=excluded.updated_at`)
    .bind(pageId, clean(identity.name || row.page_name, 200), row.page_access_token, expiresAt, row.tasks || "[]", now, now).run();
  await env.GIFT_CARD_DB.prepare("DELETE FROM marketing_facebook_oauth_pages WHERE flow_id = ?").bind(flowId).run();
  return json({ ok: true, connection: secondaryConnectionPublic({ ...row, page_id: pageId, page_name: identity.name || row.page_name, token_type: "PAGE", token_expires_at: expiresAt, latest_health_status: "healthy", latest_error: "" }) });
}

async function secondaryFacebookPreflight(env) {
  const row = await storedSecondaryFacebookConnection(env.GIFT_CARD_DB);
  if (!row) return secondaryConnectionPublic(null, { ok: false, status: "not_configured", error: "Secondary Facebook Page is not configured." });
  try {
    const [debug, identity] = await Promise.all([
      graphGet(FACEBOOK_GRAPH_ORIGIN, `${GRAPH_VERSION}/debug_token`, { input_token: row.page_access_token }, row.page_access_token, "secondary_facebook_token_debug", { accountId: row.page_id, tokenSource: "d1:facebook_secondary" }),
      graphGet(FACEBOOK_GRAPH_ORIGIN, `${GRAPH_VERSION}/me`, { fields: "id,name" }, row.page_access_token, "secondary_facebook_identity", { accountId: row.page_id, tokenSource: "d1:facebook_secondary" }),
    ]);
    const data = debug?.data || {};
    const permissions = Array.isArray(data.scopes) ? data.scopes : [];
    const ok = data.is_valid === true && String(data.type || "").toUpperCase() === "PAGE" && String(identity?.id || "") === String(row.page_id) && permissions.includes("pages_manage_posts");
    return secondaryConnectionPublic(row, { ok, status: ok ? "healthy" : "invalid", identityOk: String(identity?.id || "") === String(row.page_id), permissions, tokenValid: data.is_valid === true, error: ok ? "" : "Secondary Facebook Page connection is invalid or missing publishing permission." });
  } catch (error) {
    return secondaryConnectionPublic(row, { ok: false, status: "unavailable", error: safeMetaError(error) });
  }
}

async function secondaryFacebookPublishingEntry(env) {
  const row = await storedSecondaryFacebookConnection(env.GIFT_CARD_DB);
  if (!row) return null;
  const health = await secondaryFacebookPreflight(env);
  return {
    pageId: String(row.page_id),
    name: clean(row.page_name, 200),
    tasks: health.tasks || [],
    ok: health.ok === true,
    error: health.ok ? "" : health.error,
    token: health.ok ? row.page_access_token : "",
    pageAccessTokenAvailable: configured(row.page_access_token),
    tokenSource: "d1:facebook_secondary",
    connectionRole: "facebook_secondary",
    returnedByAccounts: true,
    classification: "managed_page",
  };
}

// Start OAuth: generate state and return Facebook OAuth URL
async function oauthStart(request, env, url, connectionRole = "primary") {
  const redirectUri = env.META_REDIRECT_URI || "https://admin.bingodogwash.com/api/admin/marketing/oauth/callback";
  const appId = env.META_APP_ID;
  if (!appId) return json({ ok: false, error: "META_APP_ID not configured." }, 400);
  const state = connectionRole === "secondary" ? `secondary.${crypto.randomUUID()}` : crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await env.GIFT_CARD_DB.prepare("INSERT OR REPLACE INTO marketing_one_time_guards (action_key, created_at) VALUES (?, ?)")
      .bind(`oauth_state:${state}`, now).run();
  } catch (e) {
    logMetaValidation("oauth_start", { validationError: clean(e?.message || String(e), 300) });
    return json({ ok: false, error: "Failed to initialise OAuth state." }, 500);
  }
  const authUrl = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  authUrl.searchParams.set("client_id", String(appId));
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", (connectionRole === "secondary" ? FACEBOOK_REQUIRED_SCOPES : [...FACEBOOK_REQUIRED_SCOPES, INSTAGRAM_PUBLISH_PERMISSION]).join(","));
  if (connectionRole === "secondary") authUrl.searchParams.set("auth_type", "reauthorize");
  return json({ ok: true, url: authUrl.toString(), state });
}

// OAuth callback: exchange code, store the long-lived user token, then inspect managed Pages.
async function oauthCallback(request, env, url) {
  const params = url.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  const origin = new URL(request.url).origin;
  const adminRedirect = (q) => Response.redirect(new URL(`/admin/marketing.html${q ? `?${q}` : ""}`, origin).toString(), 302);
  if (error) {
    logMetaValidation("oauth_callback", { validationError: clean(error, 200) });
    return adminRedirect("oauth=error&stage=authorization_denied");
  }
  if (!state) return adminRedirect("oauth=invalid_state");
  // Atomically validate and consume state so concurrent/replayed callbacks cannot
  // exchange the same single-use authorization code twice.
  let callbackStage = "code_exchange";
  try {
    const guard = await env.GIFT_CARD_DB.prepare("DELETE FROM marketing_one_time_guards WHERE action_key = ? RETURNING created_at").bind(`oauth_state:${state}`).first();
    if (!guard) return adminRedirect("oauth=invalid_state");
    const stateAge = Date.now() - new Date(guard.created_at).getTime();
    if (!Number.isFinite(stateAge) || stateAge < 0 || stateAge > 10 * 60 * 1000) return adminRedirect("oauth=error&stage=expired_state");
  } catch (e) {
    logMetaValidation("oauth_callback", { validationError: clean(e?.message || String(e), 300), stage: "state_consume" });
    return adminRedirect("oauth=error&stage=state_consume");
  }
  if (!code) return adminRedirect("oauth=missing_code");

  // Exchange code for a short-lived user token
  const redirectUri = env.META_REDIRECT_URI || "https://admin.bingodogwash.com/api/admin/marketing/oauth/callback";
  const appId = env.META_APP_ID;
  const appSecret = env.META_APP_SECRET;
  if (!appId || !appSecret) {
    logMetaValidation("oauth_callback", { validationError: "META_APP_ID or META_APP_SECRET not configured" });
    return adminRedirect("oauth=server_error");
  }
  try {
    const tokenUrl = `${FACEBOOK_GRAPH_ORIGIN}/${GRAPH_VERSION}/oauth/access_token`;
    let resp;
    let data;
    try {
      resp = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: String(appId), redirect_uri: redirectUri, client_secret: String(appSecret), code }) });
    } catch (error) {
      const diagnostic = oauthExchangeDiagnostic(callbackStage, null, null, env, redirectUri, url, clean(error?.message || "Network request failed.", 300));
      logOAuthExchangeDiagnostic(diagnostic);
      return oauthDiagnosticRedirect(adminRedirect, diagnostic);
    }
    try { data = await resp.json(); } catch {
      const diagnostic = oauthExchangeDiagnostic(`${callbackStage}_response`, resp, null, env, redirectUri, url, "Meta returned a non-JSON response.");
      logOAuthExchangeDiagnostic(diagnostic);
      return oauthDiagnosticRedirect(adminRedirect, diagnostic);
    }
    if (!resp.ok || data?.error) {
      const diagnostic = oauthExchangeDiagnostic(callbackStage, resp, data, env, redirectUri, url);
      logOAuthExchangeDiagnostic(diagnostic);
      return oauthDiagnosticRedirect(adminRedirect, diagnostic);
    }
    const shortToken = data.access_token;

    // Exchange for long-lived user token
    callbackStage = "long_token_exchange";
    const longUrl = `${FACEBOOK_GRAPH_ORIGIN}/${GRAPH_VERSION}/oauth/access_token`;
    resp = await fetch(longUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "fb_exchange_token", client_id: String(appId), client_secret: String(appSecret), fb_exchange_token: String(shortToken) }) });
    try { data = await resp.json(); } catch {
      const diagnostic = oauthExchangeDiagnostic(`${callbackStage}_response`, resp, null, env, redirectUri, url, "Meta returned a non-JSON response.", [shortToken]);
      logOAuthExchangeDiagnostic(diagnostic);
      return oauthDiagnosticRedirect(adminRedirect, diagnostic);
    }
    if (!resp.ok || data?.error) {
      const diagnostic = oauthExchangeDiagnostic(callbackStage, resp, data, env, redirectUri, url, "", [shortToken]);
      logOAuthExchangeDiagnostic(diagnostic);
      return oauthDiagnosticRedirect(adminRedirect, diagnostic);
    }
    const userLongToken = data.access_token;
    const userLongExpires = Number(data.expires_in) || 0;

    const secondaryFlow = state.startsWith("secondary.");
    if (secondaryFlow) {
      callbackStage = "secondary_page_discovery";
      const accounts = await graphGet(FACEBOOK_GRAPH_ORIGIN, `${GRAPH_VERSION}/me/accounts`, { fields: "id,name,access_token,tasks", limit: "100" }, userLongToken, "oauth_secondary_facebook_accounts", { tokenSource: "oauth:secondary:user" });
      const pages = (Array.isArray(accounts?.data) ? accounts.data : []).filter((page) => /^\d+$/.test(String(page?.id || "")) && metaAccessToken(page?.access_token).ok);
      const flowId = crypto.randomUUID();
      const now = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await env.GIFT_CARD_DB.prepare("DELETE FROM marketing_facebook_oauth_pages WHERE expires_at <= ?").bind(now).run();
      for (const page of pages) {
        await env.GIFT_CARD_DB.prepare(`INSERT INTO marketing_facebook_oauth_pages (flow_id, page_id, page_name, page_access_token, tasks, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(flowId, String(page.id), clean(page.name, 200), String(page.access_token), JSON.stringify(Array.isArray(page.tasks) ? page.tasks : []), now, expiresAt).run();
      }
      logMarketingSettings("marketing_admin_request", { action: "oauth_secondary_callback", returnedPageCount: pages.length, credentialStored: false });
      return adminRedirect(`oauth=secondary_select&flow=${encodeURIComponent(flowId)}&pages=${pages.length}`);
    }

    // Persist first. Page discovery must never prevent a valid OAuth user credential
    // from being saved, because preflight uses that credential to diagnose Page access.
    callbackStage = "d1_write";
    const now = new Date().toISOString();
    await env.GIFT_CARD_DB.prepare(`CREATE TABLE IF NOT EXISTS marketing_connections (id TEXT PRIMARY KEY, page_access_token TEXT, page_token_expires_at TEXT, instagram_access_token TEXT, instagram_token_expires_at TEXT, updated_at TEXT)`).run();
    const expiresAt = userLongExpires ? new Date(Date.now() + userLongExpires * 1000).toISOString() : "";
    await env.GIFT_CARD_DB.prepare(`
INSERT INTO marketing_connections
(id, page_access_token, page_token_expires_at, instagram_access_token, instagram_token_expires_at, updated_at)
VALUES ('primary', ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  page_access_token = excluded.page_access_token,
  page_token_expires_at = excluded.page_token_expires_at,
  updated_at = excluded.updated_at
`)
.bind(
  userLongToken,
  expiresAt,
  null,
  null,
  now
)
.run();

    callbackStage = "page_discovery";
    let returnedPageCount = 0;
    let discovery = "success";
    try {
      const accounts = await graphGet(FACEBOOK_GRAPH_ORIGIN, `${GRAPH_VERSION}/me/accounts`, { fields: "id,name,access_token", limit: "100" }, userLongToken, "oauth_facebook_accounts", { tokenSource: "d1" });
      returnedPageCount = Array.isArray(accounts?.data) ? accounts.data.length : 0;
      if (!returnedPageCount) discovery = "no_pages";
    } catch (error) {
      discovery = "failed";
      logMetaValidation("oauth_callback_page_discovery", { validationError: safeMetaError(error), diagnostic: error?.diagnostic || null });
    }

    logMarketingSettings("marketing_admin_request", { action: "oauth_callback", method: request.method, path: url.pathname, credentialStored: true, discovery, returnedPageCount });
    return adminRedirect(`oauth=success&discovery=${discovery}&pages=${returnedPageCount}`);
  } catch (error) {
    logMetaValidation("oauth_callback", { validationError: clean(error?.message || String(error), 500), stage: callbackStage });
    return adminRedirect(`oauth=error&stage=${callbackStage}`);
  }
}

function oauthExchangeDiagnostic(stage, response, data, env, redirectUri, callbackUrl, fallbackMessage = "", extraSensitiveValues = []) {
  let providerMessage = safeMetaProviderMessage(data?.error?.message) || clean(fallbackMessage, 300) || "Meta OAuth exchange failed.";
  for (const sensitive of [callbackUrl.searchParams.get("code"), env.META_APP_SECRET, ...extraSensitiveValues]) {
    if (sensitive && String(sensitive).length >= 4) providerMessage = providerMessage.replaceAll(String(sensitive), "[redacted]");
  }
  return {
    event: "meta_oauth_exchange_failure",
    stage,
    providerHttpStatus: Number.isInteger(response?.status) ? response.status : null,
    providerErrorCode: numericMetaField(data?.error?.code),
    providerErrorType: clean(data?.error?.type, 100) || null,
    providerErrorSubcode: numericMetaField(data?.error?.error_subcode),
    safeProviderMessage: providerMessage,
    appIdConfigured: configured(env.META_APP_ID),
    appSecretConfigured: configured(env.META_APP_SECRET),
    redirectUriConfigured: configured(env.META_REDIRECT_URI),
    redirectUriUsed: redirectUri,
    callbackHost: callbackUrl.host,
    productionEnvironment: callbackUrl.hostname === "admin.bingodogwash.com",
    graphHost: new URL(FACEBOOK_GRAPH_ORIGIN).host,
    graphApiVersion: GRAPH_VERSION,
    requestMethod: "POST",
  };
}

function logOAuthExchangeDiagnostic(diagnostic) {
  console.error(JSON.stringify(diagnostic));
}

function oauthDiagnosticRedirect(adminRedirect, diagnostic) {
  const params = new URLSearchParams({
    oauth: "error",
    stage: diagnostic.stage,
    httpStatus: diagnostic.providerHttpStatus == null ? "" : String(diagnostic.providerHttpStatus),
    providerCode: diagnostic.providerErrorCode == null ? "" : String(diagnostic.providerErrorCode),
    providerType: diagnostic.providerErrorType || "",
    providerSubcode: diagnostic.providerErrorSubcode == null ? "" : String(diagnostic.providerErrorSubcode),
    providerMessage: diagnostic.safeProviderMessage,
    appIdConfigured: String(diagnostic.appIdConfigured),
    appSecretConfigured: String(diagnostic.appSecretConfigured),
    redirectUriConfigured: String(diagnostic.redirectUriConfigured),
    redirectUriUsed: diagnostic.redirectUriUsed,
    callbackHost: diagnostic.callbackHost,
    productionEnvironment: String(diagnostic.productionEnvironment),
    graphHost: diagnostic.graphHost,
    graphApiVersion: diagnostic.graphApiVersion,
    requestMethod: diagnostic.requestMethod,
  });
  return adminRedirect(params.toString());
}

async function graphGet(origin, path, params, token, operation = "", context = {}) {
  const url = new URL(`${origin}/${path}`);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, value));
  let response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (error) {
    const diagnostic = metaDiagnostic(operation, null, null, networkCategory(error), context, "graph_request_failed", origin, path);
    logMetaDiagnostic(diagnostic);
    throw publishingError(META_ERROR.network, false, diagnostic);
  }
  let data = null;
  let nonJson = false;
  try { data = await response.json(); } catch { nonJson = true; }
  if (nonJson) logMetaDiagnostic(metaDiagnostic(operation, response.status, null, "non_json", context, "after_graph_response", origin, path));
  if (!response.ok) {
    const diagnostic = metaDiagnostic(operation, response.status, data, nonJson ? "non_json" : "provider_error", context, "after_graph_response", origin, path);
    if (!nonJson) logMetaDiagnostic(diagnostic);
    throw publishingError(metaApiError(data, response.status), false, diagnostic);
  }
  if (operation.includes("identity") && !nonJson && (!data || typeof data.id !== "string" || !data.id)) {
    logMetaDiagnostic(metaDiagnostic(operation, response.status, data, "malformed_response", context, "after_graph_response", origin, path));
  }
  return data || {};
}

function networkCategory(error) {
  return error?.name === "AbortError" || error?.name === "TimeoutError" ? "timeout" : "network";
}

function numericMetaField(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function metaDiagnostic(operation, status, data, category, context = {}, requestStage = "after_graph_response", origin = "", path = "") {
  const graphVersion = String(path).split("/").find((part) => /^v\d+(?:\.\d+)?$/.test(part)) || new URL(origin || "https://invalid.invalid").pathname.split("/").find((part) => /^v\d+(?:\.\d+)?$/.test(part)) || "";
  return {
    event: "meta_api_failure",
    operation,
    tokenSource: clean(context.tokenSource, 20) || "unknown",
    graphHost: origin ? new URL(origin).host : null,
    graphApiVersion: graphVersion || null,
    accountId: clean(context.accountId, 80) || null,
    providerHttpStatus: Number.isInteger(status) ? status : null,
    providerErrorCode: numericMetaField(data?.error?.code),
    providerErrorType: clean(data?.error?.type, 100) || null,
    providerErrorSubcode: numericMetaField(data?.error?.error_subcode),
    category,
    safeErrorMessage: data ? metaApiError(data, status) : category === "network" || category === "timeout" ? META_ERROR.network : META_ERROR.incomplete,
    requestStage,
    graphRequestMade: requestStage === "after_graph_response" ? true : requestStage === "before_graph_request" ? false : null,
  };
}

function logMetaDiagnostic(diagnostic) {
  if (!diagnostic?.operation) return;
  console.error(JSON.stringify(diagnostic));
}

function logMetaValidation(method, details = {}) {
  console.error(JSON.stringify({
    event: "meta_validation",
    method,
    missingConfig: details.missingConfig || null,
    validationError: details.validationError || null,
    apiErrorCode: Number.isInteger(details.apiErrorCode) ? details.apiErrorCode : null,
    apiErrorMessage: details.apiErrorMessage ? clean(details.apiErrorMessage, 500) : null,
    endpoint: details.endpoint || null,
  }));
}

function metaApiError(data, status) {
  const code = Number(data?.error?.code || 0);
  const type = typeof data?.error?.type === "string" ? data.error.type.toLowerCase() : "";
  const providerMessage = safeMetaProviderMessage(data?.error?.message);
  if (code === 190 || (type === "oauthexception" && /access token|token.*(?:expired|invalid)|session.*invalid/i.test(providerMessage))) return META_ERROR.invalid;
  if (code === 10 || code === 200) return META_ERROR.permission;
  if (status === 429 || status >= 500) return META_ERROR.network;
  return providerMessage || META_ERROR.incomplete;
}

function safeMetaError(error) {
  if (!error || typeof error.message !== "string") return META_ERROR.network;
  const message = clean(error.message, 500);
  return message || META_ERROR.network;
}

function safeMetaProviderMessage(value) {
  return clean(value, 500)
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/access_token\s*[=:]\s*[^&\s]+/gi, "access_token=[redacted]")
    .replace(/\b[A-Za-z0-9_|-]{60,}\b/g, "[redacted]");
}

function dashboardFailureCategory(error) {
  const message = String(error?.message || "").toLowerCase();
  if (/d1|database|sql|table|column/.test(message)) return "database";
  if (/fetch|network|timeout|graph|meta/.test(message)) return "upstream";
  return "internal";
}

function safeStoredMetaError(value) {
  const message = String(value || "");
  if (!message || Object.values(META_ERROR).includes(message)) return message;
  const normalized = message.toLowerCase();
  if (/access token.*(?:expired|invalid)|expired.*access token|cannot parse access token|error code\s*190/.test(normalized)) return META_ERROR.invalid;
  if (/permission|authori[sz]/.test(normalized)) return META_ERROR.permission;
  if (/missing|not configured/.test(normalized)) return META_ERROR.missing;
  if (/account|page id|user id|identity/.test(normalized)) return META_ERROR.incomplete;
  return clean(message, 500);
}

function metaAccessToken(value) {
  if (typeof value !== "string" || !value.trim()) return { ok: false, error: META_ERROR.missing };
  let token = value.trim();
  const quotedMatch = token.match(/^(['"])(.+)\1$/);
  if (quotedMatch) token = quotedMatch[2].trim();
  const bearerMatch = token.match(/^Bearer\s+(.+)$/i);
  if (bearerMatch) token = bearerMatch[1].trim();
  if (token.length < MIN_META_TOKEN_LENGTH || /[\s]/.test(token)) {
    return { ok: false, error: META_ERROR.invalid };
  }
  return { ok: true, token };
}

function publishingError(message, retryable, diagnostic = null) { const error = new Error(message); error.retryable = retryable; error.diagnostic = diagnostic; return error; }

async function dashboard(env) {
  const db = env.GIFT_CARD_DB;
  const settingsRequest = Promise.resolve().then(() => getSettings(env));
  const nextProductRequest = Promise.resolve().then(() => selectNextProduct(db, { respectCooldown: true }));
  const postsRequest = Promise.resolve().then(() => db.prepare(`SELECT marketing_posts.*,
    (SELECT status FROM marketing_platform_results WHERE post_id = marketing_posts.id AND platform = 'tiktok' ORDER BY created_at DESC LIMIT 1) AS tiktok_status,
    (SELECT external_post_id FROM marketing_platform_results WHERE post_id = marketing_posts.id AND platform = 'tiktok' ORDER BY created_at DESC LIMIT 1) AS tiktok_publish_id,
    (SELECT metadata FROM marketing_platform_results WHERE post_id = marketing_posts.id AND platform = 'tiktok' ORDER BY created_at DESC LIMIT 1) AS tiktok_metadata
    FROM marketing_posts ORDER BY created_at DESC LIMIT 50`).all());
  const totalsRequest = Promise.resolve().then(() => db.prepare(`SELECT
    COUNT(DISTINCT CASE WHEN status IN ('success','partial') THEN product_source || ':' || product_id END) AS products_promoted,
    COALESCE(SUM(CASE WHEN event_type = 'click' THEN value ELSE 0 END), 0) AS clicks,
    COALESCE(SUM(CASE WHEN event_type = 'engagement' THEN value ELSE 0 END), 0) AS engagement,
    COALESCE(SUM(CASE WHEN event_type = 'sale' THEN value ELSE 0 END), 0) AS sales
    FROM marketing_posts LEFT JOIN marketing_events ON marketing_events.post_id = marketing_posts.id`).first());
  const bestRequest = Promise.resolve().then(() => db.prepare(`SELECT product_name, COUNT(DISTINCT marketing_posts.id) AS posts,
    COALESCE(SUM(CASE WHEN event_type = 'click' THEN value ELSE 0 END), 0) AS clicks,
    COALESCE(SUM(CASE WHEN event_type = 'engagement' THEN value ELSE 0 END), 0) AS engagement,
    COALESCE(SUM(CASE WHEN event_type = 'sale' THEN value ELSE 0 END), 0) AS sales
    FROM marketing_posts LEFT JOIN marketing_events ON marketing_events.post_id = marketing_posts.id
    GROUP BY product_source, product_id, product_name ORDER BY sales DESC, clicks DESC, engagement DESC LIMIT 8`).all());
  const facebookResultsRequest = Promise.resolve().then(() => db.prepare(`SELECT marketing_platform_results.id, marketing_platform_results.post_id, marketing_platform_results.platform,
    marketing_platform_results.status, marketing_platform_results.external_post_id, marketing_platform_results.error_message,
    marketing_platform_results.metadata, marketing_platform_results.created_at,
    marketing_facebook_collaboration_followups.collaboration_state,
    marketing_facebook_collaboration_followups.completed_at AS collaboration_completed_at
    FROM marketing_platform_results
    LEFT JOIN marketing_facebook_collaboration_followups
      ON marketing_facebook_collaboration_followups.platform_result_id = marketing_platform_results.id
    WHERE marketing_platform_results.platform LIKE 'facebook:%' OR marketing_platform_results.platform LIKE 'facebook_secondary:%'
    ORDER BY marketing_platform_results.created_at DESC LIMIT 200`).all());
  const [settings, nextProduct, posts, totals, best, facebookResults] = await Promise.all([
    settingsRequest,
    nextProductRequest,
    postsRequest,
    totalsRequest,
    bestRequest,
    facebookResultsRequest,
  ]);
  const instagramStatus = await instagramPreflight(env);
  const facebookStatus = await facebookPreflight(env);
  const facebookSecondaryStatus = await secondaryFacebookPreflight(env);
  const destinationsByPost = new Map();
  for (const result of facebookResults.results || []) {
    const destination = facebookHistoryDestination(result);
    if (!destinationsByPost.has(result.post_id)) destinationsByPost.set(result.post_id, []);
    destinationsByPost.get(result.post_id).push(destination);
  }
  const history = (posts.results || []).map((post) => {
    const destinations = destinationsByPost.get(post.id) || [];
    return { ...post, error_message: safeStoredMetaError(post.error_message), ...(destinations.length ? { facebook_destinations: destinations } : {}) };
  });
  return json({
    ok: true,
    settings: shapeSettings(settings),
    connectedPlatforms: {
      facebook: facebookStatus.ok === true,
      facebookSecondary: facebookSecondaryStatus.ok === true,
      instagram: instagramStatus.ok === true
    },
    platformStatus: { facebookPrimary: facebookStatus, facebookSecondary: facebookSecondaryStatus, instagram: instagramStatus },
    lastPost: history[0] || null,
    nextEligibleProduct: nextProduct ? {
      id: String(nextProduct.id || ""),
      source: nextProduct.source || "",
      name: nextProduct.name || "",
      lastSuccessfulAt: nextProduct.last_successful_at || "",
      cooldownFallback: nextProduct.cooldownFallback === true,
      cooldownDays: PRODUCT_COOLDOWN_DAYS,
    } : null,
    history,
    analytics: { ...totals, bestProducts: best.results || [] }
  });
}

function facebookHistoryDestination(result) {
  let metadata = {};
  try { metadata = JSON.parse(result.metadata || "{}"); } catch { metadata = {}; }
  const pageId = String(metadata.pageId || result.platform.split(":")[1] || "");
  const connectionRole = metadata.connectionRole || (result.platform.startsWith("facebook_secondary:") ? "facebook_secondary" : "facebook_primary");
  const collaborationState = connectionRole === "facebook_primary" && result.status === "success"
    ? (result.collaboration_state === "completed" ? "completed" : "pending")
    : "not_applicable";
  return { platformResultId: result.id, connectionRole, pageId, pageName: clean(metadata.pageName, 200), status: result.status, externalPostId: result.external_post_id || "", error: safeStoredMetaError(result.error_message), createdAt: result.created_at, collaborationState, collaborationCompletedAt: collaborationState === "completed" ? result.collaboration_completed_at || "" : "", postUrl: "" };
}

async function updateFacebookCollaboration(request, env) {
  const input = await readJson(request);
  const platformResultId = clean(input?.platformResultId, 100);
  const collaborationState = clean(input?.state, 20);
  if (!platformResultId || !["pending", "completed"].includes(collaborationState)) {
    return json({ ok: false, error: "Choose a valid Facebook collaboration record and state." }, 400);
  }
  const result = await env.GIFT_CARD_DB.prepare(`SELECT marketing_platform_results.id, marketing_platform_results.post_id,
    marketing_platform_results.platform, marketing_platform_results.status, marketing_platform_results.metadata
    FROM marketing_platform_results
    INNER JOIN marketing_posts ON marketing_posts.id = marketing_platform_results.post_id
    WHERE marketing_platform_results.id = ? AND marketing_platform_results.platform LIKE 'facebook:%' LIMIT 1`)
    .bind(platformResultId).first();
  if (!result) return json({ ok: false, error: "Facebook Primary post record not found." }, 404);
  let metadata = {};
  try { metadata = JSON.parse(result.metadata || "{}"); } catch { metadata = {}; }
  const pageId = String(metadata.pageId || result.platform.split(":")[1] || "");
  const role = metadata.connectionRole || "facebook_primary";
  if (role !== "facebook_primary" || result.platform !== `facebook:${pageId}` || !configuredFacebookPageIds(env).includes(pageId)) {
    return json({ ok: false, error: "Facebook Primary post record not found." }, 404);
  }
  if (result.status !== "success") return json({ ok: false, error: "Collaboration follow-up applies only to successful Facebook Primary posts." }, 409);
  const now = new Date().toISOString();
  await env.GIFT_CARD_DB.prepare(`INSERT INTO marketing_facebook_collaboration_followups
    (platform_result_id, post_id, collaboration_state, completed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(platform_result_id) DO UPDATE SET
      collaboration_state = excluded.collaboration_state,
      completed_at = excluded.completed_at,
      updated_at = excluded.updated_at`)
    .bind(result.id, result.post_id, collaborationState, collaborationState === "completed" ? now : null, now, now).run();
  return json({ ok: true, platformResultId: result.id, collaborationState, completedAt: collaborationState === "completed" ? now : "" });
}

async function trackCampaignEvent(request, env, url) {
  if (request.method !== "GET" && request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);
  if (!env.GIFT_CARD_DB) return json({ ok: false, error: "Tracking unavailable." }, 503);
  const campaign = clean(url.searchParams.get("campaign"), 80);
  const type = clean(url.searchParams.get("event") || "click", 20);
  if (!campaign || !["click", "engagement", "sale"].includes(type)) return json({ ok: false, error: "Invalid tracking event." }, 400);
  if (type !== "click" && !(await hasTrackingSecret(request, env))) return json({ ok: false, error: "Tracking authorisation required." }, 401);
  const post = await env.GIFT_CARD_DB.prepare("SELECT id, product_id, product_url FROM marketing_posts WHERE campaign_code = ? LIMIT 1").bind(campaign).first();
  if (!post) return json({ ok: false, error: "Campaign not found." }, 404);
  const platform = clean(url.searchParams.get("platform"), 30);
  const now = new Date().toISOString();
  await env.GIFT_CARD_DB.prepare("INSERT INTO marketing_events (id, post_id, campaign_code, event_type, platform, value, metadata, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)")
    .bind(crypto.randomUUID(), post.id, campaign, type, platform, JSON.stringify({ campaign, platform, product: post.product_id }), now).run();
  if (request.method !== "GET") return json({ ok: true });
  await env.GIFT_CARD_DB.prepare("INSERT INTO marketing_events (id, post_id, campaign_code, event_type, platform, value, metadata, created_at) VALUES (?, ?, ?, 'redirect', ?, 1, ?, ?)")
    .bind(crypto.randomUUID(), post.id, campaign, platform, JSON.stringify({ campaign, platform, product: post.product_id }), now).run();
  const requestedDestination = trackedDestination(url.toString());
  const destination = requestedDestination === "https://bingodogwash.com/shop" ? trackedDestination(post.product_url) : requestedDestination;
  return redirectPage(destination);
}

async function getSettings(env) {
  const db = env.GIFT_CARD_DB;
  let settings = await db.prepare("SELECT * FROM marketing_settings WHERE id = 'primary'").first();
  if (!settings) {
    const now = new Date().toISOString();
    const next = nextRunAt({ schedule_hour_utc: 9, schedule_minute_utc: 0 }, new Date(now));
    const insert = db.prepare(`INSERT INTO marketing_settings (id, enabled, schedule_hour_utc, schedule_minute_utc, last_run_date, next_run_at, updated_at)
      VALUES ('primary', 0, 9, 0, '', ?, ?)`);
    const boundInsert = typeof insert.bind === "function" ? insert.bind(next, now) : insert;
    if (typeof boundInsert.run === "function") await boundInsert.run();
    else if (typeof boundInsert.first === "function") await boundInsert.first();
    else if (typeof boundInsert.all === "function") await boundInsert.all();
    settings = { id: 'primary', enabled: 0, schedule_hour_utc: 9, schedule_minute_utc: 0, last_run_date: '', next_run_at: next, updated_at: now };
  }

  const now = new Date();
  const nextRun = new Date(settings.next_run_at);
  if (!settings.next_run_at || Number.isNaN(nextRun.getTime()) || nextRun <= now) {
    const recalculated = nextRunAt(settings, now);
    if (settings.next_run_at) {
      const update = db.prepare("UPDATE marketing_settings SET next_run_at = ?, updated_at = ? WHERE id = 'primary'");
      const boundUpdate = typeof update.bind === "function" ? update.bind(recalculated, now.toISOString()) : update;
      if (typeof boundUpdate.run === "function") await boundUpdate.run();
      else if (typeof boundUpdate.first === "function") await boundUpdate.first();
      else if (typeof boundUpdate.all === "function") await boundUpdate.all();
    }
    settings.next_run_at = recalculated;
    settings.updated_at = now.toISOString();
  }

  return settings;
}

async function updateSettings(env, values) {
  const current = await getSettings(env);
  const enabled = values.enabled ?? current.enabled;
  const hour = values.schedule_hour_utc ?? current.schedule_hour_utc;
  const minute = values.schedule_minute_utc ?? current.schedule_minute_utc;
  const now = new Date();
  const next = nextRunAt({ schedule_hour_utc: hour, schedule_minute_utc: minute }, now);
  const stmt = env.GIFT_CARD_DB.prepare("UPDATE marketing_settings SET enabled = ?, schedule_hour_utc = ?, schedule_minute_utc = ?, next_run_at = ?, updated_at = ? WHERE id = 'primary'");
  const boundStmt = typeof stmt.bind === "function" ? stmt.bind(enabled, hour, minute, next, now.toISOString()) : stmt;
  if (typeof boundStmt.run === "function") await boundStmt.run();
  else if (typeof boundStmt.first === "function") await boundStmt.first();
  else if (typeof boundStmt.all === "function") await boundStmt.all();
  return json({ ok: true, settings: shapeSettings(await getSettings(env)) });
}

function nextRunAt(settings, from) {
  const next = new Date(from);
  next.setUTCSeconds(0, 0);
  next.setUTCHours(settings.schedule_hour_utc, settings.schedule_minute_utc, 0, 0);
  while (next <= from) next.setUTCHours(next.getUTCHours() + MARKETING_INTERVAL_HOURS);
  return next.toISOString();
}
function isScheduledSlot(settings, date) {
  const hourOffset = (date.getUTCHours() - Number(settings.schedule_hour_utc) + 24) % MARKETING_INTERVAL_HOURS;
  return hourOffset === 0 && date.getUTCMinutes() >= Number(settings.schedule_minute_utc) && date.getUTCMinutes() < Number(settings.schedule_minute_utc) + 15;
}
function scheduleSlotKey(settings, date) {
  const slot = new Date(date);
  slot.setUTCMinutes(Number(settings.schedule_minute_utc), 0, 0);
  return slot.toISOString().slice(0, 16);
}
function shapeSettings(row) { return { enabled: Boolean(row?.enabled), hourUtc: row?.schedule_hour_utc ?? 9, minuteUtc: row?.schedule_minute_utc ?? 0, intervalHours: MARKETING_INTERVAL_HOURS, lastRunDate: row?.last_run_date || "", nextRunAt: row?.next_run_at || "" }; }
function logMarketingSettings(event, details = {}) {
  console.error(JSON.stringify({ event, ...details }));
}
async function finishPost(db, id, status, error, results) { const now = new Date().toISOString(); await db.prepare("UPDATE marketing_posts SET status = ?, error_message = ?, attempt_count = ?, facebook_post_id = ?, instagram_post_id = ?, posted_at = ?, updated_at = ? WHERE id = ?").bind(status, clean(error, 1000), Math.max(...Object.values(results).map((r) => r.attempts || 0), 0), results.facebook?.id || "", results.instagram?.id || "", status === "failed" ? "" : now, now, id).run(); }
async function savePlatformResult(db, postId, platform, status, externalId, attempts, error, metadata = null) { const now = new Date().toISOString(); await db.prepare(`INSERT INTO marketing_platform_results (id, post_id, platform, status, external_post_id, attempt_count, error_message, metadata, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ).bind(crypto.randomUUID(), postId, platform, status, externalId, attempts, error, metadata ? JSON.stringify(metadata) : null, now, now).run(); }
async function isAdmin(request, env) { const expected = String(env.ADMIN_API_TOKEN || ""); const auth = request.headers.get("Authorization") || ""; const received = auth.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("X-Admin-Token") || ""; if (!expected || received.length !== expected.length) return false; const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", new TextEncoder().encode(received)), crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected))]); const aa = new Uint8Array(a), bb = new Uint8Array(b); let diff = 0; for (let i = 0; i < aa.length; i += 1) diff |= aa[i] ^ bb[i]; return diff === 0; }
async function hasTrackingSecret(request, env) { const expected = String(env.MARKETING_TRACKING_SECRET || ""); const received = request.headers.get("X-Marketing-Tracking-Secret") || ""; if (!expected || received.length !== expected.length) return false; const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", new TextEncoder().encode(received)), crypto.subtle.digest("SHA-256", new TextEncoder().encode(expected))]); const aa = new Uint8Array(a), bb = new Uint8Array(b); let diff = 0; for (let i = 0; i < aa.length; i += 1) diff |= aa[i] ^ bb[i]; return diff === 0; }
function campaignUrl(productUrl, campaign, platform = "") { const destination = new URL(productUrl, "https://bingodogwash.com"); destination.searchParams.set("utm_source", platform || "social"); destination.searchParams.set("utm_medium", "organic"); destination.searchParams.set("utm_campaign", campaign); const tracker = new URL(TRACK_PATH, "https://bingodogwash.com"); tracker.searchParams.set("campaign", campaign); tracker.searchParams.set("event", "click"); if (platform) tracker.searchParams.set("platform", platform); tracker.searchParams.set("destination", destination.toString()); return tracker.toString(); }
function platformCampaignUrl(value, platform) { const url = new URL(value); url.searchParams.set("platform", platform); const destination = new URL(url.searchParams.get("destination")); destination.searchParams.set("utm_source", platform); url.searchParams.set("destination", destination.toString()); return url.toString(); }
function platformCaption(caption, originalUrl, platform) { return caption.replaceAll(originalUrl, platformCampaignUrl(originalUrl, platform)); }
function trackedDestination(value) { try { const tracker = new URL(value, "https://bingodogwash.com"); const destination = new URL(tracker.searchParams.get("destination") || "/shop", "https://bingodogwash.com"); if (!/^https?:$/.test(destination.protocol)) return "https://bingodogwash.com/shop"; return destination.toString(); } catch { return "https://bingodogwash.com/shop"; } }
function redirectPage(destination) { const safeDestination = escapeHtml(destination); const scriptDestination = JSON.stringify(destination).replace(/</g, "\\u003c"); return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="1;url=${safeDestination}"><title>Bingo Dog Wash</title></head><body><main style="font:18px system-ui;text-align:center;padding:15vh 1rem"><p>Taking you to your selected product...</p><p><a href="${safeDestination}">Continue</a></p></main><script>setTimeout(function(){location.replace(${scriptDestination})},300)</script></body></html>`, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function configuredFacebookPageIds(env) { const values = configured(env.META_PAGE_IDS) ? env.META_PAGE_IDS.split(",") : []; if (configured(env.META_PAGE_ID)) values.unshift(env.META_PAGE_ID); return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))]; }
function postingEndpointResponse(result, pageIds) {
  if (!result?.platforms) return result;
  const pages = result?.platforms?.facebook?.pages || {};
  const facebook = Object.fromEntries(pageIds.map((pageId) => {
    const page = pages[pageId] || {};
    const response = { success: page.ok === true };
    if (page.id) response.postId = page.id;
    if (page.error) response.error = page.error;
    return [pageId, response];
  }));
  const instagramResult = result?.platforms?.instagram || {};
  const instagram = { success: instagramResult.ok === true };
  if (instagramResult.id) instagram.postId = instagramResult.id;
  if (instagramResult.error) instagram.error = instagramResult.error;
  return { facebook, instagram };
}
function absoluteImage(value) { return new URL(value, "https://bingodogwash.com/").toString(); }
function priceLabel(product) { return Number.isFinite(product.price) ? new Intl.NumberFormat("en-GB", { style: "currency", currency: product.currency || "GBP" }).format(product.price / 100) : "See product page"; }
function benefit(product) { const text = clean(product.description, 180).replace(/[.!?]+$/, ""); return text ? text.charAt(0).toLowerCase() + text.slice(1) : `everyday ${clean(product.category || "dog care", 60).toLowerCase()}`; }
function hash(value) { let output = 2166136261; for (const char of String(value)) { output ^= char.charCodeAt(0); output = Math.imul(output, 16777619); } return output >>> 0; }
function configured(value) { return typeof value === "string" && value.trim().length > 0; }
function publishingDisabled(env) { return String(env?.MARKETING_PUBLISHING_DISABLED || "").trim().toLowerCase() === "true"; }
function publishingDisabledResponse() { return json({ ok: false, skipped: "publishing-disabled", error: "Publishing is disabled in this environment." }, 423); }
function clean(value, max = 500) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
async function readJson(request) { try { return await request.json(); } catch { return null; } }
function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }

export const marketingTestHelpers = { campaignUrl, trackedDestination, nextRunAt, isScheduledSlot, scheduleSlotKey, hash, benefit, metaAccessToken, resolveMetaConnection, resolveFacebookPublishingContext, resolveFacebookPageAccess, publishWithRetry, publishFacebook, publishInstagram, waitForInstagramMedia, publishFacebookPages, validateInstagramImage, selectNextProduct, selectInstagramProduct, canonicalEtsyAffiliateUrl, instagramFeedCaption, configuredFacebookPageIds, postingEndpointResponse, redirectPage, instagramPreflight, facebookPreflight, facebookHistoryDestination, publishingDisabled };
