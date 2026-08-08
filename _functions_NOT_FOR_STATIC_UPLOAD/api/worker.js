import { AsyncLocalStorage } from "node:async_hooks";
import { handleCompetition, processCompetitionStripeEvent } from "./competition.js";
import { handleMarketingRequest, isMarketingPath, runMarketingSchedule } from "./marketing.js";

const ALLOWED_ORIGINS = new Set([
  "https://bingodogwash.com",
  "https://www.bingodogwash.com",
  "https://admin.bingodogwash.com",
]);
const ADMIN_AI_DRAFTS_ORIGINS = new Set([
  "https://bingodogwash.com",
  "https://admin.bingodogwash.com",
]);

const PRICE_ID = "price_1TplhKRvgV7zITZBn7OylVwF";
const EBAY_ACCOUNT_DELETION_PATH = "/api/ebay-account-deletion";
const EBAY_ACCOUNT_DELETION_ENDPOINT =
  "https://bingodogwash.com/api/ebay-account-deletion";
const EBAY_PRODUCTS_PATH = "/api/ebay/products";
const AVASAM_PRODUCTS_PATH = "/api/avasam/products";
const GIFT_CARD_CHECKOUT_PATH = "/api/gift-cards/checkout";
const GIFT_CARD_BALANCE_PATH = "/api/gift-cards/balance";
const CONTACT_PATH = "/api/contact";
const NEWSLETTER_PATH = "/api/newsletter";
const ADMIN_NEWSLETTER_PATH = "/api/admin/newsletter";
const ADMIN_GIFT_CARDS_PATH = "/api/admin/gift-cards";
const PROFESSIONALS_PATH = "/api/professionals";
const PROFESSIONAL_APPLICATIONS_PATH = "/api/professionals/applications";
const PROFESSIONAL_APPLICATION_STATUS_PATH = "/api/professionals/application-status";
const PROFESSIONAL_DIRECTORY_PATH = "/api/professionals/directory";
const PROFESSIONAL_PROFILE_PATH = "/api/professionals/profile";
const PROFESSIONAL_ENQUIRIES_PATH = "/api/professionals/enquiries";
const ADMIN_PROFESSIONALS_PATH = "/api/admin/professionals";
const BOOKINGS_PENDING_PATH = "/api/bookings/pending";
const BOOKINGS_CHECKOUT_PATH = "/api/bookings/checkout";
const ADMIN_BOOKINGS_PATH = "/api/admin/bookings";
const ADMIN_STRIPE_PATH = "/api/admin/stripe";
const ADMIN_AI_DRAFTS_PATH = "/api/admin/ai-drafts";
const GIVEAWAY_CHECKOUT_PATH = "/api/giveaway/checkout";
const ADMIN_GIVEAWAY_PATH = "/api/admin/giveaway-entries";
const ADMIN_GIVEAWAY_FEED_PATH = "/api/giveaway/admin-feed";
const STRIPE_WEBHOOK_PATH = "/api/stripe-webhook";
const COMPETITIONS_API_PATH = "/api/competitions";
const ADMIN_COMPETITIONS_API_PATH = "/api/admin/competitions";
const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;
const GIFT_CARD_DELIVERY_CRON = "*/15 * * * *";

const CONTACT_DEPARTMENTS = {
  general: {
    label: "General enquiry",
    to: "hello@bingodogwash.com",
  },
  sales: {
    label: "Sales",
    to: "sales@bingodogwash.com",
  },
  support: {
    label: "Customer support",
    to: "support@bingodogwash.com",
  },
  bookings: {
    label: "Bookings",
    to: "bookings@bingodogwash.com",
  },
  partners: {
    label: "Affiliate & Partnerships",
    to: "partners@bingodogwash.com",
  },
};

const AVASAM_TOKEN_URL =
  "https://app.avasam.com/api/auth/request-token";

const AVASAM_PRODUCTS_URL =
  "https://app.avasam.com/apiseeker/Products/GetSellerProductList";
const ETSY_PRODUCTS_PATH = "/api/etsy/products";
const ETSY_CONNECT_PATH = "/api/etsy/connect";
const ETSY_CALLBACK_PATH = "/api/etsy/callback";
const ADMIN_ETSY_PATH = "/api/admin/etsy";
const ADMIN_PAGES_PATH = "/api/admin/pages";
const FEED_STATUS_PATH = "/api/feed-status";
const EBAY_OAUTH_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_BROWSE_SEARCH_URL =
  "https://api.ebay.com/buy/browse/v1/item_summary/search";

/* ---------- Helper Functions ---------- */

function firstValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }

    if (Array.isArray(value)) {
      const nested = firstValue(...value);
      if (nested !== undefined) return nested;
      continue;
    }

    return value;
  }

  return undefined;
}

const EBAY_BROWSE_SCOPE = "https://api.ebay.com/oauth/api_scope";
const STATIC_PRODUCT_FEEDS = {
  "avasam-products.json": {
  "products": [
    {
      "id": "collar-adjustable-blue",
      "name": "Adjustable Blue Dog Collar",
      "category": "Collars",
      "price": 7.99,
      "stock": 36,
      "supplier": "Avasam",
      "description": "Comfortable adjustable collar for everyday walks and dog care."
    },
    {
      "id": "lead-nylon-walking",
      "name": "Nylon Dog Walking Lead",
      "category": "Leads",
      "price": 9.49,
      "stock": 28,
      "supplier": "Avasam",
      "description": "Lightweight walking lead for daily walks, training and travel."
    },
    {
      "id": "harness-padded-comfort",
      "name": "Padded Comfort Dog Harness",
      "category": "Harnesses",
      "price": 16.99,
      "stock": 19,
      "supplier": "Avasam",
      "description": "Padded dog harness for secure, comfortable walking."
    },
    {
      "id": "bed-washable-soft",
      "name": "Washable Soft Dog Bed",
      "category": "Bedding",
      "price": 29.99,
      "stock": 12,
      "supplier": "Avasam",
      "description": "Soft washable dog bed for home comfort after a fresh wash."
    },
    {
      "id": "toy-rope-tug",
      "name": "Rope Tug Dog Toy",
      "category": "Toys",
      "price": 5.99,
      "stock": 44,
      "supplier": "Avasam",
      "description": "Durable rope toy for tug, play and enrichment."
    },
    {
      "id": "wipes-fresh-coat",
      "name": "Fresh Coat Dog Wipes",
      "category": "Dog Wipes",
      "price": 4.99,
      "stock": 52,
      "supplier": "Avasam",
      "description": "Handy dog wipes for paws, coats and quick clean-ups between washes."
    }
  ]
}
,
  "etsy-products.json": {
  "products": [
    { "id": "personalised-dog-tag", "name": "Personalised Dog Name Tag", "category": "Accessories", "priceLabel": "Price on Etsy", "supplier": "Etsy", "status": "External checkout", "externalUrl": "https://www.etsy.com/uk/search?q=personalised+dog+tag", "description": "Personalised dog ID tags from Etsy sellers." },
    { "id": "handmade-dog-bandana", "name": "Handmade Dog Bandana", "category": "Accessories", "priceLabel": "Price on Etsy", "supplier": "Etsy", "status": "External checkout", "externalUrl": "https://www.etsy.com/uk/search?q=handmade+dog+bandana", "description": "Handmade dog bandanas and custom pet accessories." },
    { "id": "dog-treat-jar", "name": "Personalised Dog Treat Jar", "category": "Treats", "priceLabel": "Price on Etsy", "supplier": "Etsy", "status": "External checkout", "externalUrl": "https://www.etsy.com/uk/search?q=personalised+dog+treat+jar", "description": "Custom treat storage jars for dog owners." },
    { "id": "dog-towel-hook", "name": "Dog Towel Hook", "category": "Accessories", "priceLabel": "Price on Etsy", "supplier": "Etsy", "status": "External checkout", "externalUrl": "https://www.etsy.com/uk/search?q=dog+towel+hook", "description": "Dog lead, towel and grooming hooks from Etsy makers." }
  ]
}
};

const EBAY_AFFILIATE_PARAMS = {
  mkcid: "1",
  mkrid: "710-53481-19255-0",
  siteid: "3",
  campid: "5339164469",
  customid: "",
  toolid: "10001",
  mkevt: "1",
};

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https: data: blob:",
    "frame-src 'self' https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://www.instagram.com",
    "connect-src 'self' https://challenges.cloudflare.com https://bingodogwash.com https://admin.bingodogwash.com https://bingo-checkout.bingowash.workers.dev",
    "form-action 'self' https://formspree.io https://*.stripe.com https://checkout.stripe.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
  ].join("; "),
};

const requestEnvStorage = new AsyncLocalStorage();

export default {
  async fetch(request, env) {
    return requestEnvStorage.run(env || {}, async () => {
      try {
        const response = await handleRequestWithAssets(request, env || {});
        return withSecurityHeaders(response, request);
      } catch (error) {
        logError("Unhandled Worker error", error, request);
        return withSecurityHeaders(corsResponse(request, { ok: false, error: "Internal server error." }, 500), request);
      }
    });
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runMarketingSchedule(event, env || {}).catch((error) => logError("Marketing schedule failed", error)));
    if (event.cron === GIFT_CARD_DELIVERY_CRON) {
      ctx.waitUntil(requestEnvStorage.run(env || {}, () => deliverDueGiftCards()));
      return;
    }
    if (flagValue(env?.ETSY_FEATURE_ENABLED) && flagValue(env?.ETSY_SYNC_ENABLED)) {
      ctx.waitUntil(requestEnvStorage.run(env || {}, () => runEtsySync("scheduled", "scheduled")));
    }
  }
};

async function handleRequestWithAssets(request, env) {
  const url = new URL(request.url);

  if (url.hostname === "admin.bingodogwash.com" && url.pathname === "/") {
    const adminRequestUrl = new URL(request.url);
    adminRequestUrl.pathname = "/admin/index.html";
    return env.ASSETS
      ? env.ASSETS.fetch(new Request(adminRequestUrl, request))
      : handleRequest(request);
  }

  const pagePolicyResponse = await enforcePublicPagePolicy(request, url);
  if (pagePolicyResponse) return pagePolicyResponse;

  const response = await handleRequest(request);
  if (response.status !== 404 || url.pathname.startsWith("/api/") || url.pathname === "/health") {
    return response;
  }

  return env.ASSETS ? env.ASSETS.fetch(request) : response;
}

async function enforcePublicPagePolicy(request, url) {
  if (!giftCardDb() || request.method !== "GET") return null;
  if (url.hostname === "admin.bingodogwash.com" || url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/") || isLongLivedStaticAsset(url.pathname)) return null;
  let route = url.pathname.replace(/\.html$/i, "").replace(/\/$/, "") || "/";
  const page = await giftCardDb().prepare("SELECT status, redirect_target FROM site_pages WHERE route = ? LIMIT 1").bind(route).first();
  if (!page || page.status === "live") return null;
  const redirectTarget = cleanText(page.redirect_target, 200);
  if (redirectTarget && redirectTarget.startsWith("/") && !redirectTarget.startsWith("//")) {
    return Response.redirect(new URL(redirectTarget, url.origin).toString(), 302);
  }
  return new Response("This page is temporarily unavailable.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
  });
}

function withSecurityHeaders(response, request) {
  const secured = new Response(response.body, response);
  Object.entries(SECURITY_HEADERS).forEach(([name, value]) => {
    if (!secured.headers.has(name)) {
      secured.headers.set(name, value);
    }
  });
  setDefaultCachePolicy(secured, request);
  return secured;
}

function setDefaultCachePolicy(response, request) {
  if (response.headers.has("Cache-Control") || !request) return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname === "/health") {
    response.headers.set("Cache-Control", "no-store");
    return;
  }

  if (isLongLivedStaticAsset(url.pathname)) {
    response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return;
  }

  response.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
}

function isLongLivedStaticAsset(pathname) {
  return /\.(?:avif|gif|ico|jpg|jpeg|png|svg|webp|woff2?)$/i.test(pathname);
}

function logError(message, error, request) {
  const url = request ? new URL(request.url) : null;
  console.error(JSON.stringify({
    level: "error",
    message,
    path: url?.pathname || "",
    method: request?.method || "",
    error: error?.message || String(error || "unknown"),
  }));
}

function logExternalError(message, details = {}) {
  console.error(JSON.stringify({
    level: "error",
    message,
    status: Number.isInteger(details.status) ? details.status : undefined,
    reason: cleanText(details.reason || details.error?.message || details.error || "unknown", 300),
  }));
}

function supplierErrorMessage(data) {
  if (!data || typeof data !== "object") {
    return cleanText(data || "unknown", 300);
  }

  return cleanText(
    data.message ||
    data.Message ||
    data.error_description ||
    data.error?.message ||
    data.error ||
    data.title ||
    data.rawResponse ||
    "External service returned an error.",
    300
  );
}

function envValue(name) {
  const activeEnv = requestEnvStorage.getStore();
  if (activeEnv && Object.prototype.hasOwnProperty.call(activeEnv, name)) {
    return activeEnv[name];
  }

  return typeof globalThis !== "undefined" ? globalThis[name] : undefined;
}

function envText(name) {
  const value = envValue(name);
  return typeof value === "string" ? value : "";
}

function handleRequest(request) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    if (url.pathname === ADMIN_AI_DRAFTS_PATH) {
      const origin = request.headers.get("Origin") || "";
      return ADMIN_AI_DRAFTS_ORIGINS.has(origin)
        ? aiDraftCorsResponse(request, null, 204)
        : aiDraftCorsResponse(request, { ok: false, error: "Origin is not allowed." }, 403);
    }
    return corsResponse(request, null, 204);
  }

  if (isCompetitionApiPath(url.pathname)) {
    return handleCompetition(request, requestEnvStorage.getStore() || {}, url);
  }

  if (isMarketingPath(url.pathname)) {
    return handleMarketingRequest(request, requestEnvStorage.getStore() || {}, url);
  }

  if (url.pathname === FEED_STATUS_PATH) {
    if (url.searchParams.get("view") === "giveaway") {
      return handleAdminGiveawayEntries(request, url);
    }
    return handleFeedStatus(request);
  }

  if (url.pathname === CONTACT_PATH) {
    return handleContactForm(request);
  }

  if (url.pathname === NEWSLETTER_PATH) {
    return handleNewsletterSubscription(request);
  }

  if (url.pathname === ADMIN_NEWSLETTER_PATH) {
    return handleAdminNewsletter(request, url);
  }

  if (url.pathname === "/api/checkout" && request.method === "POST") {
    return createWashCheckout(request);
  }

  if (url.pathname === BOOKINGS_CHECKOUT_PATH && request.method === "POST") {
    return createWashCheckout(request);
  }

  if (url.pathname === BOOKINGS_PENDING_PATH) {
    return handlePendingWashBooking(request);
  }

  if (url.pathname === ADMIN_BOOKINGS_PATH) {
    return handleAdminWashBookings(request, url);
  }

  if (url.pathname === ADMIN_STRIPE_PATH) {
    return handleAdminStripe(request);
  }

  if (url.pathname === ADMIN_AI_DRAFTS_PATH) {
    return handleAdminAiDrafts(request);
  }

  if (url.pathname === GIVEAWAY_CHECKOUT_PATH) {
    return createGiveawayCheckout(request);
  }

  if (url.pathname === ADMIN_GIVEAWAY_PATH || url.pathname === ADMIN_GIVEAWAY_FEED_PATH) {
    return handleAdminGiveawayEntries(request, url);
  }

  if (url.pathname === GIFT_CARD_CHECKOUT_PATH) {
    return createGiftCardCheckout(request);
  }

  if (url.pathname === GIFT_CARD_BALANCE_PATH) {
    return handleGiftCardBalance(request);
  }

  if (url.pathname === PROFESSIONALS_PATH || url.pathname.startsWith(`${PROFESSIONALS_PATH}/`)) {
    return handleProfessionals(request, url);
  }

  if (url.pathname === ADMIN_GIFT_CARDS_PATH || url.pathname.startsWith(`${ADMIN_GIFT_CARDS_PATH}/`)) {
    return handleAdminGiftCards(request, url);
  }

  if (url.pathname === ADMIN_PROFESSIONALS_PATH || url.pathname.startsWith(`${ADMIN_PROFESSIONALS_PATH}/`)) {
    return handleAdminProfessionals(request, url);
  }

  if (url.pathname === ADMIN_ETSY_PATH || url.pathname.startsWith(`${ADMIN_ETSY_PATH}/`)) {
    return handleAdminEtsy(request, url);
  }

  if (url.pathname === ADMIN_PAGES_PATH || url.pathname.startsWith(`${ADMIN_PAGES_PATH}/`)) {
    return handleAdminPages(request, url);
  }

  if (url.pathname === ETSY_CONNECT_PATH) {
    return handleEtsyConnect(request);
  }

  if (url.pathname === ETSY_CALLBACK_PATH) {
    return handleEtsyCallback(request, url);
  }

  if (url.pathname === STRIPE_WEBHOOK_PATH) {
    return handleStripeWebhook(request);
  }

  if (url.pathname === EBAY_ACCOUNT_DELETION_PATH) {
    return handleEbayAccountDeletion(request, url);
  }

  if (
    url.pathname === EBAY_PRODUCTS_PATH ||
    url.pathname === `${EBAY_PRODUCTS_PATH}/`
  ) {
    return handleEbayProducts(request, url);
  }


  if (
    url.pathname === AVASAM_PRODUCTS_PATH ||
    url.pathname === `${AVASAM_PRODUCTS_PATH}/`
  ) {
    return handleAvasamProducts(request, url);
  }

  if (url.pathname === ETSY_PRODUCTS_PATH || url.pathname === `${ETSY_PRODUCTS_PATH}/`) {
    return handlePublicEtsyProducts(request, url);
  }
  if (url.pathname === "/health") {
    return corsResponse(request, {
      ok: true,
      service: "Bingo Dog Wash Checkout",
    });
  }

  return corsResponse(
    request,
    { ok: false, error: "Not found." },
    404
  );
}

function isCompetitionApiPath(pathname) {
  return pathname === COMPETITIONS_API_PATH ||
    pathname.startsWith(`${COMPETITIONS_API_PATH}/`) ||
    pathname === ADMIN_COMPETITIONS_API_PATH ||
    pathname.startsWith(`${ADMIN_COMPETITIONS_API_PATH}/`);
}



function configured(value) {
  return typeof value === "string" && value.trim() !== "";
}

async function handleNewsletterSubscription(request) {
  if (request.method !== "POST") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }

  const origin = request.headers.get("Origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return corsResponse(request, { ok: false, error: "Submission origin is not allowed." }, 403);
  }

  let input;
  try {
    const contentType = request.headers.get("Content-Type") || "";
    input = contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries(await request.formData());
  } catch {
    return corsResponse(request, { ok: false, error: "Could not read the subscription." }, 400);
  }

  if (cleanText(input.website, 200)) {
    return corsResponse(request, { ok: true, subscribed: true });
  }

  const email = cleanEmail(input.email);
  if (!email) {
    return corsResponse(request, { ok: false, error: "Enter a valid email address." }, 400);
  }

  const database = giftCardDb();
  if (!database) {
    return corsResponse(request, { ok: false, error: "Subscriptions are temporarily unavailable." }, 503);
  }

  const now = new Date().toISOString();
  await database.prepare(`
    INSERT INTO newsletter_subscribers
      (id, email, status, source, consent_text, subscribed_at, updated_at)
    VALUES (?, ?, 'Subscribed', 'Homepage', ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      status = 'Subscribed',
      source = 'Homepage',
      consent_text = excluded.consent_text,
      updated_at = excluded.updated_at
  `).bind(
    crypto.randomUUID(),
    email.toLowerCase(),
    "Requested Bingo Dog Wash product, offer and location updates.",
    now,
    now
  ).run();

  return corsResponse(request, { ok: true, subscribed: true });
}

async function handleAdminNewsletter(request, url) {
  if (!(await isAdminRequest(request))) {
    return corsResponse(request, { ok: false, error: "Admin authorisation required." }, 401);
  }
  if (request.method !== "GET") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }

  const database = giftCardDb();
  if (!database) {
    return corsResponse(request, { ok: false, error: "Newsletter database unavailable." }, 503);
  }

  const result = await database.prepare(`
    SELECT id, email, status, source, consent_text, subscribed_at, updated_at
    FROM newsletter_subscribers
    ORDER BY subscribed_at DESC
    LIMIT 1000
  `).all();
  const subscribers = result.results || [];

  if (url.searchParams.get("format") === "csv") {
    const rows = [
      ["Email", "Status", "Source", "Subscribed at"],
      ...subscribers.map((subscriber) => [
        subscriber.email,
        subscriber.status,
        subscriber.source,
        subscriber.subscribed_at
      ])
    ];
    const csv = rows
      .map((row) => row.map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv;charset=UTF-8",
        "Content-Disposition": "attachment; filename=\"bingo-newsletter-subscribers.csv\""
      }
    });
  }

  return corsResponse(request, {
    ok: true,
    count: subscribers.length,
    subscribers: subscribers.map((subscriber) => ({
      id: subscriber.id,
      email: subscriber.email,
      status: subscriber.status,
      source: subscriber.source,
      consentText: subscriber.consent_text,
      subscribedAt: subscriber.subscribed_at,
      updatedAt: subscriber.updated_at
    }))
  });
}

async function handleContactForm(request) {
  if (request.method === "GET") {
    return Response.redirect(new URL("/contact.html", request.url), 303);
  }

  if (request.method !== "POST") {
    return contactHtmlResponse(request, "Method not allowed", ["Please use the contact form to send a message."], 405);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return contactHtmlResponse(request, "Check the contact form", ["We could not read your form submission."], 400);
  }

  if (cleanText(form.get("website"), 200)) {
    return Response.redirect(new URL("/thank-you.html", request.url), 303);
  }

  const submission = {
    department: cleanText(form.get("department"), 40),
    name: cleanText(form.get("name"), 120),
    email: cleanEmail(form.get("email")),
    telephone: cleanText(form.get("telephone"), 40),
    message: cleanMultilineText(form.get("message"), 4000),
  };

  const errors = validateContactSubmission(submission);
  if (errors.length) {
    return contactHtmlResponse(request, "Check the contact form", errors, 400);
  }

  const from = envText("FORM_FROM_EMAIL");
  if (!envText("RESEND_API_KEY") || !from) {
    return contactHtmlResponse(request, "Message not sent", ["The contact form is not configured yet. Please email hello@bingodogwash.com."], 500);
  }

  const department = CONTACT_DEPARTMENTS[submission.department];
  const sent = await sendResendEmail({
    from,
    to: department.to,
    subject: `Bingo Dog Wash ${department.label} message from ${submission.name}`,
    html: contactEmailHtml(submission, department),
    text: contactEmailText(submission, department),
    replyTo: submission.email,
    errorLabel: "Resend contact email failed",
  });

  if (!sent) {
    return contactHtmlResponse(request, "Message not sent", ["We could not send your message just now. Please email hello@bingodogwash.com."], 502);
  }

  return Response.redirect(new URL("/thank-you.html", request.url), 303);
}

function validateContactSubmission(submission) {
  const errors = [];
  if (!CONTACT_DEPARTMENTS[submission.department]) errors.push("Choose a department.");
  if (!submission.name) errors.push("Enter your name.");
  if (!submission.email) errors.push("Enter a valid email address.");
  if (!submission.message) errors.push("Enter your message.");
  if (submission.telephone && !/^[0-9+() .-]{7,40}$/.test(submission.telephone)) {
    errors.push("Enter a valid telephone number or leave it blank.");
  }
  return errors;
}

function contactEmailText(submission, department) {
  return [
    `Department: ${department.label}`,
    `Name: ${submission.name}`,
    `Email: ${submission.email}`,
    `Telephone: ${submission.telephone || "Not supplied"}`,
    "",
    "Message:",
    submission.message,
  ].join("\n");
}

function contactEmailHtml(submission, department) {
  const rows = [
    ["Department", department.label],
    ["Name", submission.name],
    ["Email", submission.email],
    ["Telephone", submission.telephone || "Not supplied"],
  ];

  return `
    <div style="font-family:Arial,sans-serif;color:#102033">
      <h1>New Bingo Dog Wash contact message</h1>
      <table cellpadding="6" cellspacing="0" border="0">
        ${rows.map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}
      </table>
      <h2>Message</h2>
      <p>${escapeHtml(submission.message).replace(/\n/g, "<br>")}</p>
    </div>
  `;
}

function contactHtmlResponse(request, title, messages, status) {
  return new Response(`<!doctype html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | Bingo Dog Wash</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <main class="container">
    <section class="page-title">
      <span class="eyebrow">Contact form</span>
      <h1>${escapeHtml(title)}</h1>
      ${messages.map((message) => `<p>${escapeHtml(message)}</p>`).join("")}
      <div class="button-row"><a class="btn btn-primary" href="/contact.html">Back to contact form</a></div>
    </section>
  </main>
</body>
</html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function handleFeedStatus(request) {
  if (request.method !== "GET") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }

  const avasamReady =
    configured(envText("AVASAM_CONSUMER_KEY")) &&
    configured(envText("AVASAM_SECRET_KEY"));
  const etsyReady =
    configured(envText("ETSY_API_KEY")) ||
    configured(envText("ETSY_FEED_URL"));

  return corsResponse(request, {
    ok: true,
    feeds: {
      avasam: {
        liveReady: avasamReady,
        liveEndpoint: AVASAM_PRODUCTS_PATH,
        requiredSecrets: ["AVASAM_CONSUMER_KEY", "AVASAM_SECRET_KEY"]
      },
      etsy: {
        liveReady: etsyReady,
        liveEndpoint: ETSY_PRODUCTS_PATH,
        requiredSecrets: ["ETSY_API_KEY or ETSY_FEED_URL"],
        optionalSecrets: ["ETSY_AUTH_HEADER", "ETSY_AUTH_PREFIX"]
      }
    }
  });
}
function etsyFeedConfig(requestUrl) {
  const configuredFeedUrl = envText("ETSY_FEED_URL");
  const etsyApiKey = envText("ETSY_API_KEY");
  const query = requestUrl.searchParams.get("q") || "dog accessories";
  const limit = cleanLimit(requestUrl.searchParams.get("limit"), 12, 25);
  let feedUrl = configuredFeedUrl;

  if (!feedUrl && etsyApiKey) {
    const etsyUrl = new URL("https://api.etsy.com/v3/application/listings/active");
    etsyUrl.searchParams.set("keywords", query);
    etsyUrl.searchParams.set("limit", String(limit));
    feedUrl = etsyUrl.toString();
  }

  return {
    source: "Etsy",
    filename: "etsy-products.json",
    feedUrl,
    apiKey: etsyApiKey,
    authHeader: configuredFeedUrl ? (envText("ETSY_AUTH_HEADER") || "Authorization") : "x-api-key",
    authPrefix: configuredFeedUrl ? (envText("ETSY_AUTH_PREFIX") || "Bearer") : "",
    normalize: normalizeEtsyListings
  };
}

async function handleSupplierProductFeed(request, config) {
  if (request.method !== "GET") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }

  if (!config.feedUrl && config.noFallback) {
    return corsResponse(request, {
      ok: false,
      source: config.source,
      live: false,
      liveConfigured: false,
      fallback: false,
      count: 0,
      products: [],
      missingSecrets: config.requiredSecrets || [],
      error: `${config.source} temporarily unavailable. Missing required secret: ${(config.requiredSecrets || []).join(", ")}.`
    }, 503);
  }

  if (config.feedUrl) {
    try {
      const liveProducts = await fetchLiveProductFeed(config);
      if (liveProducts.length) {
        return corsResponse(request, {
          ok: true,
          source: config.source,
          live: true,
          liveConfigured: true,
          fallback: false,
          refreshedAt: new Date().toISOString(),
          count: liveProducts.length,
          products: liveProducts
        });
      }
    } catch (error) {
      logExternalError(config.source + " live feed error", { error });
      if (config.noFallback) {
        return corsResponse(request, {
          ok: false,
          source: config.source,
          live: false,
          liveConfigured: true,
          fallback: false,
          count: 0,
          products: [],
          error: `${config.source} temporarily unavailable. ${error.message || "Live feed failed."}`
        }, 502);
      }
    }
  }

  const fallbackProducts = fallbackProductsFor(config.filename);
  return corsResponse(request, {
    ok: true,
    source: config.source,
    live: false,
    liveConfigured: Boolean(config.feedUrl),
    fallback: true,
    count: fallbackProducts.length,
    products: fallbackProducts,
    note: config.feedUrl
      ? config.source + " live feed did not return products, so fallback products are shown."
      : config.source + " live feed is not configured. Add the supplier feed URL/API key as Wrangler secrets."
  });
}

async function fetchLiveProductFeed(config) {
  const headers = new Headers({ Accept: "application/json" });
  if (config.apiKey) {
    const value = config.authPrefix ? config.authPrefix + " " + config.apiKey : config.apiKey;
    headers.set(config.authHeader, value);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Supplier feed timed out."), 8000);
  let response;
  try {
    response = await fetch(config.feedUrl, {
      headers,
      signal: controller.signal,
      cf: { cacheTtl: 300, cacheEverything: true }
    });
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(config.source + " live feed did not return JSON.");
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(config.source + " live feed returned " + response.status);
  }

  const products = extractProducts(data);
  if (!Array.isArray(products)) {
    throw new Error(config.source + " live feed response did not contain a product array.");
  }
  return typeof config.normalize === "function" ? config.normalize(products) : products;
}

function extractProducts(data) {
  if (Array.isArray(data)) return data;
  return data.products || data.items || data.data || data.results || data.listings || [];
}

function fallbackProductsFor(filename) {
  const data = STATIC_PRODUCT_FEEDS[filename] || { products: [] };
  return Array.isArray(data) ? data : data.products || data.items || [];
}

function normalizeMoney(value) {
  if (value && typeof value === "object") {
    return normalizeMoney(firstValue(value.amount, value.value, value.price));
  }

  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeStock(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function imageValues(value) {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(imageValues);
  if (typeof value === "object") {
    return [
      value.url,
      value.Url,
      value.url_570xN,
      value.url_fullxfull,
      value.src,
      value.Src,
      value.image,
      value.Image,
      value.imageUrl,
      value.ImageUrl,
      value.primaryImage,
      value.thumbnail,
      value.images,
      value.Images
    ].flatMap(imageValues);
  }
  return [];
}

function cleanImageUrl(value, baseOrigin) {
  try {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const url = raw.startsWith("/") && baseOrigin ? new URL(raw, baseOrigin) : new URL(raw);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeEtsyListings(items) {
  return items.map((item, index) => {
    const price = typeof item.price === "object" ? Number(item.price.amount) / Number(item.price.divisor || 100) : Number(item.price);
    return {
      id: "etsy-" + cleanText(item.listing_id || item.listingId || item.id || "listing-" + (index + 1), 80),
      name: cleanText(item.title || item.name || "Etsy product " + (index + 1), 180),
      category: cleanText(item.category || item.taxonomy_path?.[0] || "Etsy Pet Products", 120),
      price: Number.isFinite(price) ? price : null,
      priceLabel: Number.isFinite(price) ? "" : "Price on Etsy",
      image: cleanUrl(item.image || item.imageUrl || item.images?.[0]?.url_570xN || item.images?.[0]?.url_fullxfull || ""),
      supplier: "Etsy",
      commission: "Affiliate",
      status: "External checkout",
      externalUrl: cleanUrl(item.url || item.externalUrl || item.listingUrl || ""),
      description: cleanText(item.description || "Live Etsy listing.", 500)
    };
  }).filter((product) => product.name && product.externalUrl);
}


async function handleAvasamProducts(request, url) {
  if (request.method !== "GET") {
    return corsResponse(
      request,
      { ok: false, error: "Method not allowed." },
      405
    );
  }

  const consumerKey = envText("AVASAM_CONSUMER_KEY");
  const secretKey = envText("AVASAM_SECRET_KEY");

  if (!consumerKey || !secretKey) {
    return avasamFallbackResponse(
      request,
      "Avasam API credentials are not configured."
    );
  }

  const page = cleanAvasamPage(url.searchParams.get("page"));
  const limit = cleanLimit(url.searchParams.get("limit"), 20, 100);

  try {
    const accessToken = await requestAvasamAccessToken(
      consumerKey,
      secretKey
    );

    const products = await requestAvasamProducts(
      accessToken,
      page,
      limit
    );

    if (!products.length) {
      return avasamFallbackResponse(
        request,
        "Avasam returned no products."
      );
    }

    return corsResponse(request, {
      ok: true,
      source: "Avasam",
      live: true,
      liveConfigured: true,
      fallback: false,
      page,
      limit,
      count: products.length,
      products
    });
  } catch (error) {
    logExternalError("Avasam API error", { error });

    return avasamFallbackResponse(
      request,
      error instanceof Error
        ? error.message
        : "Avasam products are temporarily unavailable."
    );
  }
}

async function requestAvasamAccessToken(consumerKey, secretKey) {
  const response = await fetch(AVASAM_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      consumer_key: consumerKey,
      secret_key: secretKey
    })
  });

  const data = await readAvasamJson(response);

  const accessToken = firstValue(data.access_token, data.AccessToken, data.token, data.Token, data.authkey, data.Authkey, data.AuthKey);

  if (!response.ok || !accessToken) {
    logExternalError("Avasam token response", {
      status: response.status,
      reason: supplierErrorMessage(data)
    });

    const apiMessage = cleanText(
      data?.message ||
      data?.Message ||
      data?.error_description ||
      data?.error ||
      data?.title ||
      data?.rawResponse ||
      "No explanation was returned by Avasam.",
      300
    );

    throw new Error(
      "Avasam token request failed with HTTP " +
      response.status +
      ": " +
      apiMessage
    );
  }

  return accessToken;
}

async function requestAvasamProducts(accessToken, page, limit) {
  const attempts = [
    {
      name: "Authorization raw token",
      headers: {
        Accept: "application/json",
        Authorization: accessToken,
        "Content-Type": "application/json"
      },
      body: {
        Page: page,
        Limit: limit
      }
    },
    {
      name: "Authorization Bearer token",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: {
        Page: page,
        Limit: limit
      }
    },
    {
      name: "Authkey header",
      headers: {
        Accept: "application/json",
        Authkey: accessToken,
        "Content-Type": "application/json"
      },
      body: {
        Page: page,
        Limit: limit
      }
    },
    {
      name: "Authkey request body",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: {
        Authkey: accessToken,
        Page: page,
        Limit: limit
      }
    }
  ];

  const failures = [];

  for (const attempt of attempts) {
    const response = await fetch(AVASAM_PRODUCTS_URL, {
      method: "POST",
      headers: attempt.headers,
      body: JSON.stringify(attempt.body)
    });

    const data = await readAvasamJson(response);

    if (response.ok) {
      const items = avasamItemsFromResponse(data);

      console.log(JSON.stringify({
        level: "info",
        message: "Avasam authentication format succeeded",
        method: attempt.name
      }));

      return items
        .map(normalizeAvasamProduct)
        .filter(Boolean);
    }

    failures.push({
      method: attempt.name,
      status: response.status,
      message: cleanText(
        data?.message ||
        data?.Message ||
        data?.error ||
        data?.error_description ||
        data?.title ||
        data?.rawResponse ||
        "",
        150
      )
    });
  }

  logExternalError("All Avasam authentication attempts failed", {
    reason: failures
      .map((failure) => `${failure.method}=${failure.status}`)
      .join("; ")
  });

  const summary = failures
    .map((failure) =>
      failure.method +
      "=" +
      failure.status +
      (failure.message ? " " + failure.message : "")
    )
    .join("; ");

  throw new Error(
    "All Avasam product authentication formats failed: " +
    summary
  );
}


function avasamItemsFromResponse(data) {
  if (Array.isArray(data)) return data;

  const candidates = [
    data?.data,
    data?.Data,
    data?.products,
    data?.Products,
    data?.items,
    data?.Items,
    data?.productList,
    data?.ProductList,
    data?.sellerProducts,
    data?.SellerProducts,
    data?.result,
    data?.Result,
    data?.response,
    data?.Response
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === "object") {
      const nested = avasamItemsFromResponse(candidate);
      if (nested.length) return nested;
    }
  }

  return [];
}
function normalizeAvasamProduct(item, index) {
  const sku = cleanText(
    item.SKU ||
    item.sku ||
    `product-${index + 1}`,
    120
  );

  const name = cleanText(
    item.Title ||
    item.title ||
    item.MultiTitle?.en ||
    item.name,
    180
  );

  if (!name) {
    return null;
  }

  const retailPrice = Number(
    item.RetailPrice ??
    item.RetailPriceIncVat ??
    item.retailPrice
  );

  const costPrice = Number(
    item.Price ??
    item.PriceIncVat ??
    item.price
  );

  const price =
    Number.isFinite(retailPrice) && retailPrice > 0
      ? retailPrice
      : Number.isFinite(costPrice)
        ? costPrice
        : null;

  const rawImages = [
  item.Image,
  item.image,
  item.MainImage,
  item.mainImage,
  item.ImageUrl,
  item.imageUrl,
  item.ProductImage,
  item.ProductImages,
  item.Images,
  item.images
];

const imageUrls = rawImages
  .flatMap((value) => {
    if (!value) return [];

    if (typeof value === "string") {
      return [value];
    }

    if (Array.isArray(value)) {
      return value.flatMap((entry) => {
        if (typeof entry === "string") {
          return [entry];
        }

        if (entry && typeof entry === "object") {
          return [
            entry.url,
            entry.Url,
            entry.image,
            entry.Image,
            entry.imageUrl,
            entry.ImageUrl
          ].filter(Boolean);
        }

        return [];
      });
    }

    if (typeof value === "object") {
      return [
        value.url,
        value.Url,
        value.image,
        value.Image,
        value.imageUrl,
        value.ImageUrl
      ].filter(Boolean);
    }

    return [];
  })
  .map(cleanUrl)
  .filter(Boolean);

const uniqueImages = [...new Set(imageUrls)];
const image = uniqueImages[0] || "";

  return {
    id: `avasam-${sku}`,
    sku,
    name,
    category: cleanText(
      item.Category ||
      item.category ||
      "Avasam Products",
      120
    ),
    price,
    priceLabel: Number.isFinite(price)
      ? ""
      : "Price unavailable",
    image,
    imageUrl: image,  
    primaryImage: image,
    images: uniqueImages,
    galleryImages: uniqueImages.slice(1),
    supplier: "Avasam",
    commission: "Direct margin",
    status: "Available through Avasam",
    description: cleanText(
      item.Description ||
      item.description ||
      item.MultiDescription?.en ||
      "Avasam product.",
      500
    )
  };
}

function firstAvasamImage(images) {
  if (!Array.isArray(images)) {
    return "";
  }

  return images.find(
    (image) => typeof image === "string" && image
  ) || "";
}

function cleanAvasamPage(value) {
  const page = Number.parseInt(value, 10);

  if (!Number.isFinite(page) || page < 0) {
    return 0;
  }

  return page;
}

async function readAvasamJson(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      rawResponse: text.slice(0, 500)
    };
  }
}

function avasamFallbackResponse(request, reason) {
  const products = fallbackProductsFor("avasam-products.json");

  return corsResponse(request, {
    ok: true,
    source: "Avasam",
    live: false,
    liveConfigured: true,
    fallback: true,
    count: products.length,
    products,
    note:
      `${reason} The built-in Avasam products are being shown instead.`
  });
}
async function handleEbayProducts(request, url) {
  if (request.method !== "GET") {
    return corsResponse(
      request,
      {
        ok: false,
        error: "Method not allowed.",
      },
      405
    );
  }

  const clientId = envText("EBAY_BROWSE_CLIENT_ID");
  const clientSecret = envText("EBAY_BROWSE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    return corsResponse(request, {
      ok: false,
      credentialsConfigured: false,
      query: cleanEbayQuery(url.searchParams.get("q")) || "dog grooming",
      products: [],
      error:
        "eBay Browse API credentials are not configured. Add EBAY_BROWSE_CLIENT_ID and EBAY_BROWSE_CLIENT_SECRET.",
    });
  }

  const query = cleanEbayQuery(url.searchParams.get("q")) || "dog grooming";
  const limit = cleanLimit(url.searchParams.get("limit"), 50, 50);

  try {
    const accessToken = await ebayApplicationAccessToken(clientId, clientSecret);
    const searchUrl = new URL(EBAY_BROWSE_SEARCH_URL);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("limit", String(limit));
    searchUrl.searchParams.set("filter", "buyingOptions:{FIXED_PRICE}");

    const ebayResponse = await fetch(searchUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
        "X-EBAY-C-ENDUSERCTX": "contextualLocation=country%3DGB",
      },
    });

    const ebayData = await ebayResponse.json();

    if (!ebayResponse.ok) {
      logExternalError("eBay Browse API error", {
        status: ebayResponse.status,
        reason: supplierErrorMessage(ebayData)
      });

      return corsResponse(
        request,
        {
          ok: false,
          error: "eBay Browse API could not return products.",
        },
        502
      );
    }

    const products = Array.isArray(ebayData.itemSummaries)
      ? ebayData.itemSummaries.map(normalizeEbayProduct).filter(Boolean)
      : [];

    return corsResponse(request, {
      ok: true,
      query,
      products,
    });
  } catch (error) {
    logExternalError("eBay Browse endpoint error", { error });

    return corsResponse(
      request,
      {
        ok: false,
        error: "eBay products are temporarily unavailable.",
      },
      502
    );
  }
}

async function ebayApplicationAccessToken(clientId, clientSecret) {
  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("scope", EBAY_BROWSE_SCOPE);

  const response = await fetch(EBAY_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await response.json();

  const accessToken = firstValue(data.access_token, data.AccessToken, data.token, data.Token, data.authkey, data.Authkey, data.AuthKey);

  if (!response.ok || !accessToken) {
    logExternalError("eBay OAuth error", {
      status: response.status,
      reason: supplierErrorMessage(data)
    });
    throw new Error("eBay OAuth token request failed.");
  }

  return accessToken;
}

function normalizeEbayProduct(item) {
  const title = cleanText(item.title, 180);
  const itemUrl = cleanUrl(item.itemWebUrl);

  if (!title || !itemUrl) return null;

  return {
    title,
    price: normalizeEbayPrice(item.price),
    image: cleanUrl(item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl),
    seller: cleanText(item.seller?.username || "eBay seller", 120),
    itemUrl: ebayAffiliateUrl(itemUrl),
  };
}

function normalizeEbayPrice(price) {
  const value = Number(price?.value);
  const currency = cleanText(price?.currency, 12) || "GBP";

  return {
    value: Number.isFinite(value) ? value : null,
    currency,
    display: Number.isFinite(value)
      ? new Intl.NumberFormat("en-GB", {
          style: "currency",
          currency,
        }).format(value)
      : "Price on eBay",
  };
}

function cleanEbayQuery(value) {
  return cleanText(value, 100).replace(/\*/g, "");
}

function cleanLimit(value, fallback, max) {
  const limit = Number.parseInt(value, 10);

  if (!Number.isFinite(limit) || limit < 1) return fallback;

  return Math.min(limit, max);
}

function cleanUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function ebayAffiliateUrl(value) {
  try {
    const url = new URL(value);

    Object.entries(EBAY_AFFILIATE_PARAMS).forEach(([key, paramValue]) => {
      url.searchParams.set(key, paramValue);
    });

    return url.toString();
  } catch {
    return value;
  }
}

async function handleEbayAccountDeletion(request, url) {
  if (request.method === "GET") {
    return ebayChallengeResponse(url);
  }

  if (request.method === "POST") {
    return new Response(null, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(JSON.stringify({
    ok: false,
    error: "Method not allowed.",
  }), {
    status: 405,
    headers: {
      Allow: "GET, POST",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

async function ebayChallengeResponse(url) {
  const challengeCode = url.searchParams.get("challenge_code");

  if (!challengeCode) {
    return new Response(JSON.stringify({
      ok: false,
      error: "Missing challenge_code.",
    }), {
      status: 400,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  // Add this Cloudflare secret with your eBay verification token:
  // wrangler secret put EBAY_MARKETPLACE_ACCOUNT_DELETION_TOKEN
  const verificationToken = envText("EBAY_MARKETPLACE_ACCOUNT_DELETION_TOKEN");

  if (!verificationToken) {
    return new Response(JSON.stringify({
      ok: false,
      error: "eBay verification token is not configured.",
    }), {
      status: 500,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }

  const challengeResponse = await sha256Hex(
    `${challengeCode}${verificationToken}${EBAY_ACCOUNT_DELETION_ENDPOINT}`
  );

  return new Response(JSON.stringify({ challengeResponse }), {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createWashCheckout(request) {
  const stripeSecretKey = envText("STRIPE_SECRET_KEY");

  if (!stripeSecretKey) {
    return corsResponse(
      request,
      {
        ok: false,
        error: "STRIPE_SECRET_KEY is not configured.",
      },
      500
    );
  }

  let input;

  try {
    input = await request.json();
  } catch {
    return corsResponse(
      request,
      {
        ok: false,
        error: "Invalid JSON request.",
      },
      400
    );
  }

  const email = cleanEmail(input.email);
  const customerName = cleanText(input.name, 120);
  const telephone = cleanText(input.telephone || input.phone, 80);
  const dogName = cleanText(input.dogName || input.dog_name, 120);
  const notes = cleanText(input.notes || input.message, 400);
  const bookingReference = cleanReference(
    input.bookingReference ||
    input.booking_reference ||
    input.clientReferenceId ||
    `BDW-${Date.now()}`
  );

  if (!email) {
    return corsResponse(
      request,
      {
        ok: false,
        error: "A valid email address is required.",
      },
      400
    );
  }

  if (!customerName) {
    return corsResponse(
      request,
      {
        ok: false,
        error: "Customer name is required.",
      },
      400
    );
  }

  if (!giftCardDb()) {
    return corsResponse(request, { ok: false, error: "Booking database is not configured." }, 503);
  }

  const booking = await giftCardDb()
    .prepare("SELECT booking_reference FROM wash_bookings WHERE booking_reference = ? AND email = ? LIMIT 1")
    .bind(bookingReference, email)
    .first();

  if (!booking) {
    return corsResponse(request, { ok: false, error: "Save the booking before starting payment." }, 404);
  }

  const stripeBody = new URLSearchParams();

  stripeBody.set("mode", "payment");
  stripeBody.set("success_url", "https://bingodogwash.com/thank-you.html?session_id={CHECKOUT_SESSION_ID}");
  stripeBody.set("cancel_url", "https://bingodogwash.com/wash.html?payment=cancelled");
  stripeBody.set("customer_email", email);
  stripeBody.set("client_reference_id", bookingReference);

  stripeBody.set("line_items[0][price]", PRICE_ID);
  stripeBody.set("line_items[0][quantity]", "1");

  stripeBody.set("metadata[booking_reference]", bookingReference);
  stripeBody.set("metadata[customer_name]", customerName);
  stripeBody.set("metadata[email]", email);
  stripeBody.set("metadata[telephone]", telephone || "Not supplied");
  stripeBody.set("metadata[dog_name]", dogName || "Not supplied");
  stripeBody.set("metadata[notes]", notes || "None");

  stripeBody.set("payment_intent_data[metadata][booking_reference]", bookingReference);
  stripeBody.set("payment_intent_data[metadata][customer_name]", customerName);
  stripeBody.set("payment_intent_data[metadata][dog_name]", dogName || "Not supplied");
  stripeBody.set("payment_intent_data[metadata][telephone]", telephone || "Not supplied");

  stripeBody.set("custom_text[submit][message]", "Payment is for one self-service dog wash.");

  const stripeResponse = await fetch(
    "https://api.stripe.com/v1/checkout/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: stripeBody.toString(),
    }
  );

  const stripeData = await stripeResponse.json();

  if (!stripeResponse.ok || !stripeData.url) {
    logExternalError("Stripe checkout error", {
      status: stripeResponse.status,
      reason: supplierErrorMessage(stripeData?.error || stripeData)
    });

    return corsResponse(
      request,
      {
        ok: false,
        error:
          stripeData?.error?.message ||
          "Stripe Checkout could not be created.",
      },
      502
    );
  }

  await giftCardDb()
    .prepare(`UPDATE wash_bookings
      SET stripe_checkout_session_id = ?, updated_at = ?
      WHERE booking_reference = ?`)
    .bind(cleanText(stripeData.id, 180), new Date().toISOString(), bookingReference)
    .run();

  return corsResponse(request, {
    ok: true,
    paymentUrl: stripeData.url,
    sessionId: stripeData.id,
    bookingReference,
  });
}

async function handlePendingWashBooking(request) {
  if (request.method !== "POST") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }
  if (!giftCardDb()) {
    return corsResponse(request, { ok: false, error: "Booking database is not configured." }, 503);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return corsResponse(request, { ok: false, error: "Invalid JSON request." }, 400);
  }

  const name = cleanText(input.name, 120);
  const email = cleanEmail(input.email);
  if (!name || !email) {
    return corsResponse(request, { ok: false, error: "Your name and a valid email are required." }, 400);
  }

  const now = new Date().toISOString();
  const booking = {
    id: crypto.randomUUID(),
    bookingReference: `BDW-${crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`,
    name,
    email,
    telephone: cleanText(input.telephone || input.phone, 80),
    dogName: cleanText(input.dog_name || input.dogName, 120),
    notes: cleanText(input.notes || input.message, 400),
    preferredTime: cleanText(input.preferred_time || input.preferredTime || input.time, 120),
    amount: 1000,
    currency: "GBP",
    status: "Pending Stripe payment",
    createdAt: now,
  };

  await giftCardDb().prepare(`INSERT INTO wash_bookings (
    id, booking_reference, customer_name, email, telephone, dog_name, notes,
    preferred_time, amount, currency, status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      booking.id, booking.bookingReference, booking.name, booking.email,
      booking.telephone, booking.dogName, booking.notes, booking.preferredTime,
      booking.amount, booking.currency, booking.status, now, now
    )
    .run();

  return corsResponse(request, {
    ok: true,
    booking: { ...booking, dog_name: booking.dogName, price: "£10.00" },
  }, 201);
}

async function handleAdminWashBookings(request, url) {
  if (!(await isAdminRequest(request))) {
    return corsResponse(request, { ok: false, error: "Admin authorisation required." }, 401);
  }
  if (request.method !== "GET") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }
  if (!giftCardDb()) {
    return corsResponse(request, { ok: false, error: "Booking database is not configured." }, 503);
  }

  const limit = cleanLimit(url.searchParams.get("limit"), 50, 100);
  const result = await giftCardDb().prepare(`SELECT
    id, booking_reference, customer_name, email, telephone, dog_name, notes,
    preferred_time, amount, currency, status, stripe_checkout_session_id,
    stripe_payment_intent_id, stripe_payment_status, created_at, updated_at, paid_at
    FROM wash_bookings ORDER BY created_at DESC LIMIT ?`)
    .bind(limit)
    .all();

  const bookings = (result.results || []).map((row) => ({
    id: row.id,
    bookingReference: row.booking_reference,
    name: row.customer_name,
    email: row.email,
    telephone: row.telephone || "",
    dog_name: row.dog_name || "",
    notes: row.notes || "",
    preferred_time: row.preferred_time || "",
    amount: row.amount,
    currency: row.currency,
    price: `£${(Number(row.amount || 0) / 100).toFixed(2)}`,
    status: row.status,
    stripePaymentStatus: row.stripe_payment_status || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at || "",
  }));

  return corsResponse(request, { ok: true, bookings });
}

async function handleAdminStripe(request) {
  if (!(await isAdminRequest(request))) {
    return corsResponse(request, { ok: false, error: "Admin authorisation required." }, 401);
  }
  if (request.method !== "GET") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }
  if (!giftCardDb()) {
    return corsResponse(request, { ok: false, error: "Payments database is not configured." }, 503);
  }

  const summary = await giftCardDb().prepare(`SELECT
    (SELECT COUNT(*) FROM wash_bookings WHERE LOWER(COALESCE(stripe_payment_status, '')) = 'paid' OR LOWER(status) = 'paid') AS wash_count,
    (SELECT COALESCE(SUM(amount), 0) FROM wash_bookings WHERE LOWER(COALESCE(stripe_payment_status, '')) = 'paid' OR LOWER(status) = 'paid') AS wash_total,
    (SELECT COUNT(*) FROM gift_cards) AS gift_card_count,
    (SELECT COALESCE(SUM(original_amount), 0) FROM gift_cards) AS gift_card_total,
    (SELECT COUNT(*) FROM giveaway_entries WHERE LOWER(payment_status) = 'paid') AS giveaway_count,
    (SELECT COALESCE(SUM(amount), 0) FROM giveaway_entries WHERE LOWER(payment_status) = 'paid') AS giveaway_total,
    (SELECT COUNT(*) FROM competition_entries WHERE LOWER(payment_status) = 'paid') AS competition_count,
    (SELECT COALESCE(SUM(amount), 0) FROM competition_entries WHERE LOWER(payment_status) = 'paid') AS competition_total,
    (SELECT MAX(created_at) FROM gift_card_events WHERE stripe_event_id IS NOT NULL) AS last_webhook_at`).first();

  const recentResult = await giftCardDb().prepare(`SELECT source, reference, customer, amount, currency, status, created_at
    FROM (
      SELECT 'Dog wash' AS source, booking_reference AS reference, customer_name AS customer,
        amount, currency, COALESCE(stripe_payment_status, status) AS status, created_at
      FROM wash_bookings WHERE stripe_checkout_session_id IS NOT NULL
      UNION ALL
      SELECT 'Gift card' AS source, code AS reference, recipient_name AS customer,
        original_amount AS amount, currency, status, created_at
      FROM gift_cards
      UNION ALL
      SELECT 'Giveaway' AS source, 'Entry ' || entry_number AS reference,
        TRIM(first_name || ' ' || last_name) AS customer, amount, currency, payment_status AS status, created_at
      FROM giveaway_entries
      UNION ALL
      SELECT 'Competition' AS source, 'Entry ' || entry_number AS reference, dog_name AS customer,
        amount, 'GBP' AS currency, payment_status AS status, created_at
      FROM competition_entries WHERE stripe_checkout_session_id IS NOT NULL
    ) ORDER BY created_at DESC LIMIT 50`).all();

  const money = (value) => Number(value || 0);
  const totals = {
    wash: { count: Number(summary?.wash_count || 0), amount: money(summary?.wash_total) },
    giftCards: { count: Number(summary?.gift_card_count || 0), amount: money(summary?.gift_card_total) },
    giveaway: { count: Number(summary?.giveaway_count || 0), amount: money(summary?.giveaway_total) },
    competition: { count: Number(summary?.competition_count || 0), amount: money(summary?.competition_total) },
  };

  return corsResponse(request, {
    ok: true,
    connection: {
      secretKeyConfigured: configured(envText("STRIPE_SECRET_KEY")),
      webhookSecretConfigured: configured(envText("STRIPE_WEBHOOK_SECRET")),
      webhookPath: STRIPE_WEBHOOK_PATH,
      lastWebhookAt: summary?.last_webhook_at || "",
    },
    totals: {
      ...totals,
      count: Object.values(totals).reduce((total, item) => total + item.count, 0),
      amount: Object.values(totals).reduce((total, item) => total + item.amount, 0),
      currency: "GBP",
    },
    recent: (recentResult.results || []).map((row) => ({
      source: row.source,
      reference: row.reference,
      customer: row.customer,
      amount: Number(row.amount || 0),
      currency: row.currency || "GBP",
      status: row.status || "Unknown",
      createdAt: row.created_at,
    })),
  });
}

function normalizeGiveawayInput(input = {}) {
  return {
    firstName: publicText(input.firstName, 80),
    lastName: publicText(input.lastName, 80),
    email: cleanEmail(input.email),
    phone: publicText(input.phone, 40),
    termsAccepted: input.termsAccepted === true,
    submissionId: String(input.submissionId || "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80),
  };
}

function isAllowedSameOriginRequest(request) {
  const origin = request.headers.get("Origin") || "";
  const fetchSite = (request.headers.get("Sec-Fetch-Site") || "").toLowerCase();
  return (!origin || ALLOWED_ORIGINS.has(origin)) && fetchSite !== "cross-site";
}

async function createGiveawayCheckout(request) {
  if (request.method !== "POST") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }
  if (!isAllowedSameOriginRequest(request)) {
    return corsResponse(request, { ok: false, error: "Invalid request origin." }, 403);
  }
  if (!giftCardDb()) {
    return corsResponse(request, { ok: false, error: "Giveaway database is not configured." }, 503);
  }

  const stripeSecretKey = envText("STRIPE_SECRET_KEY");
  if (!stripeSecretKey || !stripeSecretKey.startsWith("sk_")) {
    return corsResponse(request, { ok: false, error: "Giveaway checkout is unavailable." }, 503);
  }

  let rawInput;
  try {
    rawInput = await request.json();
  } catch {
    return corsResponse(request, { ok: false, error: "Invalid JSON request." }, 400);
  }
  const input = normalizeGiveawayInput(rawInput);
  if (!input.firstName || !input.lastName || !input.email) {
    return corsResponse(request, { ok: false, error: "First name, last name and a valid email address are required." }, 400);
  }
  if (!input.termsAccepted) {
    return corsResponse(request, { ok: false, error: "You must agree to the Giveaway Terms & Conditions." }, 400);
  }
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(input.submissionId)) {
    return corsResponse(request, { ok: false, error: "Invalid giveaway submission." }, 400);
  }

  const stripeBody = new URLSearchParams();
  stripeBody.set("mode", "payment");
  stripeBody.set("success_url", "https://bingodogwash.com/thank-you?giveaway=success&session_id={CHECKOUT_SESSION_ID}");
  stripeBody.set("cancel_url", "https://bingodogwash.com/giveaway?payment=cancelled");
  stripeBody.set("customer_email", input.email);
  stripeBody.set("client_reference_id", `BDW-GIVEAWAY-${input.submissionId}`.slice(0, 200));
  stripeBody.set("line_items[0][price_data][currency]", "gbp");
  stripeBody.set("line_items[0][price_data][product_data][name]", "Bingo Dog Wash Giveaway Entry");
  stripeBody.set("line_items[0][price_data][product_data][description]", "One entry for the £20 One4All Gift Card giveaway.");
  stripeBody.set("line_items[0][price_data][unit_amount]", "200");
  stripeBody.set("line_items[0][quantity]", "1");
  stripeBody.set("metadata[type]", "giveaway");
  stripeBody.set("metadata[first_name]", input.firstName);
  stripeBody.set("metadata[last_name]", input.lastName);
  stripeBody.set("metadata[email]", input.email);
  stripeBody.set("metadata[phone]", input.phone);
  stripeBody.set("metadata[submission_id]", input.submissionId);
  stripeBody.set("payment_intent_data[metadata][type]", "giveaway");
  stripeBody.set("payment_intent_data[metadata][submission_id]", input.submissionId);

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `giveaway-${input.submissionId}`,
    },
    body: stripeBody.toString(),
  });
  const stripeData = await stripeResponse.json();
  if (!stripeResponse.ok || !stripeData.url) {
    logExternalError("Stripe giveaway checkout error", {
      status: stripeResponse.status,
      reason: supplierErrorMessage(stripeData?.error || stripeData),
    });
    return corsResponse(request, { ok: false, error: "Stripe Checkout could not be created." }, 502);
  }

  return corsResponse(request, { ok: true, paymentUrl: stripeData.url, sessionId: stripeData.id });
}

async function handleAdminGiveawayEntries(request, url) {
  if (!(await isAdminRequest(request))) {
    return corsResponse(request, { ok: false, error: "Admin authorisation required." }, 401);
  }
  if (request.method !== "GET") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }
  if (!giftCardDb()) {
    return corsResponse(request, { ok: false, error: "Giveaway database is not configured." }, 503);
  }

  const q = publicText(url.searchParams.get("q"), 120);
  const csvRequested = url.searchParams.get("format") === "csv";
  const page = csvRequested ? 1 : Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = csvRequested ? 5000 : cleanLimit(url.searchParams.get("pageSize"), 20, 100);
  const sortColumns = { entryNumber: "entry_number", name: "last_name", email: "email", amount: "amount", status: "payment_status", date: "created_at" };
  const sort = sortColumns[url.searchParams.get("sort")] || "created_at";
  const direction = url.searchParams.get("direction") === "asc" ? "ASC" : "DESC";
  const search = `%${q}%`;
  const where = q ? "WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?" : "";
  const countStatement = giftCardDb().prepare(`SELECT COUNT(*) AS total FROM giveaway_entries ${where}`);
  const countRow = q ? await countStatement.bind(search, search, search, search).first() : await countStatement.first();
  const total = Number(countRow?.total || 0);
  const offset = (page - 1) * pageSize;
  const listStatement = giftCardDb().prepare(`SELECT entry_number, first_name, last_name, email, phone, stripe_payment_id, amount, currency, payment_status, created_at FROM giveaway_entries ${where} ORDER BY ${sort} ${direction} LIMIT ? OFFSET ?`);
  const result = q
    ? await listStatement.bind(search, search, search, search, pageSize, offset).all()
    : await listStatement.bind(pageSize, offset).all();
  const entries = (result.results || []).map(giveawayEntryRow);

  if (csvRequested) {
    const header = ["Entry Number", "First Name", "Last Name", "Email", "Phone", "Amount", "Payment Status", "Date"];
    const csv = [header, ...entries.map((entry) => [entry.entryNumber, entry.firstName, entry.lastName, entry.email, entry.phone, entry.amountDisplay, entry.paymentStatus, entry.createdAt])]
      .map((row) => row.map(csvCell).join(",")).join("\r\n");
    return new Response(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=giveaway-entries.csv", "Cache-Control": "no-store" } });
  }

  return corsResponse(request, { ok: true, entries, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
}

function giveawayEntryRow(row) {
  return {
    entryNumber: row.entry_number,
    firstName: row.first_name,
    lastName: row.last_name,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    phone: row.phone || "",
    stripePaymentId: row.stripe_payment_id,
    amount: row.amount,
    amountDisplay: formatMoney(row.amount),
    currency: row.currency,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
  };
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

async function createGiftCardCheckout(request) {
  if (request.method !== "POST") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }

  const stripeSecretKey = envText("STRIPE_SECRET_KEY");

  if (!stripeSecretKey || !stripeSecretKey.startsWith("sk_")) {
    return corsResponse(request, {
      ok: false,
      comingSoon: true,
      error: "Gift card checkout is coming soon.",
    }, 503);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return corsResponse(request, { ok: false, error: "Invalid JSON request." }, 400);
  }

  const amountPounds = Number(input.amount);
  const quantity = Number.parseInt(input.quantity || "1", 10);
  const amount = Math.round(amountPounds * 100);
  const expectedTotal = amount * quantity;
  const submittedTotal = Number.parseInt(input.total || input.totalAmount || "0", 10);
  const recipientName = cleanText(input.recipientName, 120);
  const recipientEmail = cleanEmail(input.recipientEmail);
  const buyerName = cleanText(input.buyerName, 120);
  const buyerEmail = cleanEmail(input.buyerEmail);
  const message = cleanText(input.message, 500);
  const deliveryDate = cleanDeliveryDate(input.deliveryDate);

  if (!Number.isFinite(amountPounds) || amount < 500 || amount > 20000) {
    return corsResponse(request, { ok: false, error: "Gift card amount must be between £5 and £200." }, 400);
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return corsResponse(request, { ok: false, error: "Quantity must be between 1 and 10." }, 400);
  }

  if (submittedTotal && submittedTotal !== expectedTotal) {
    return corsResponse(request, { ok: false, error: "Gift card total does not match the selected amount and quantity." }, 400);
  }

  if (!recipientName || !recipientEmail || !buyerName || !buyerEmail) {
    return corsResponse(request, { ok: false, error: "Recipient and buyer names and emails are required." }, 400);
  }

  const reference = cleanReference(`BDW-GC-${Date.now()}`);
  const stripeBody = new URLSearchParams();

  stripeBody.set("mode", "payment");
  stripeBody.set("success_url", "https://bingodogwash.com/gift-card-success.html?session_id={CHECKOUT_SESSION_ID}");
  stripeBody.set("cancel_url", "https://bingodogwash.com/gift-cards.html?payment=cancelled");
  stripeBody.set("customer_email", buyerEmail);
  stripeBody.set("client_reference_id", reference);
  stripeBody.set("line_items[0][price_data][currency]", "gbp");
  stripeBody.set("line_items[0][price_data][product_data][name]", "Bingo Dog Wash Digital Gift Card");
  stripeBody.set("line_items[0][price_data][product_data][description]", `Digital gift card worth ${formatMoney(amount)}.`);
  stripeBody.set("line_items[0][price_data][unit_amount]", String(amount));
  stripeBody.set("line_items[0][quantity]", String(quantity));
  stripeBody.set("metadata[type]", "gift_card");
  stripeBody.set("metadata[gift_card_value]", String(amount));
  stripeBody.set("metadata[gift_card_value_display]", formatMoney(amount));
  stripeBody.set("metadata[quantity]", String(quantity));
  stripeBody.set("metadata[total_amount]", String(expectedTotal));
  stripeBody.set("metadata[total_amount_display]", formatMoney(expectedTotal));
  stripeBody.set("metadata[recipient_name]", recipientName);
  stripeBody.set("metadata[recipient_email]", recipientEmail);
  stripeBody.set("metadata[buyer_name]", buyerName);
  stripeBody.set("metadata[buyer_email]", buyerEmail);
  stripeBody.set("metadata[message]", message || "");
  stripeBody.set("metadata[delivery_date]", deliveryDate || "");
  stripeBody.set("payment_intent_data[metadata][type]", "gift_card");
  stripeBody.set("payment_intent_data[metadata][gift_card_value]", String(amount));
  stripeBody.set("payment_intent_data[metadata][quantity]", String(quantity));
  stripeBody.set("payment_intent_data[metadata][total_amount]", String(expectedTotal));
  stripeBody.set("payment_intent_data[metadata][delivery_date]", deliveryDate || "");
  stripeBody.set("payment_intent_data[metadata][message]", message || "");

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: stripeBody.toString(),
  });
  const stripeData = await stripeResponse.json();

  if (!stripeResponse.ok || !stripeData.url) {
    logExternalError("Stripe gift card checkout error", {
      status: stripeResponse.status,
      reason: supplierErrorMessage(stripeData?.error || stripeData)
    });
    return corsResponse(request, {
      ok: false,
      error: stripeData?.error?.message || "Gift card Stripe Checkout could not be created.",
    }, 502);
  }

  return corsResponse(request, {
    ok: true,
    paymentUrl: stripeData.url,
    sessionId: stripeData.id,
    reference,
  });
}

async function handleStripeWebhook(request) {
  if (request.method !== "POST") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }

  if (!giftCardDb()) {
    return corsResponse(request, { ok: false, error: "Gift card database is not configured." }, 500);
  }

  const stripeWebhookSecret = envText("STRIPE_WEBHOOK_SECRET");

  if (!configured(stripeWebhookSecret)) {
    return corsResponse(request, { ok: false, error: "STRIPE_WEBHOOK_SECRET is not configured." }, 500);
  }

  const payload = await request.text();
  const signature = request.headers.get("Stripe-Signature") || "";

  if (!(await verifyStripeSignature(payload, signature, stripeWebhookSecret))) {
    return corsResponse(request, { ok: false, error: "Invalid Stripe webhook signature." }, 400);
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return corsResponse(request, { ok: false, error: "Invalid webhook JSON." }, 400);
  }

  const duplicate = await giftCardDb()
    .prepare("SELECT id FROM gift_card_events WHERE stripe_event_id = ?")
    .bind(event.id || "")
    .first();

  if (duplicate) {
    return corsResponse(request, { ok: true, duplicate: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object || {};
    if (session.metadata?.type === "competition_entry") {
      const processed = await processCompetitionStripeEvent(event, requestEnvStorage.getStore() || {});
      if (!processed) return corsResponse(request, { ok: false, error: "Invalid competition payment event." }, 400);
    } else if (session.metadata?.type === "giveaway") {
      if (session.payment_status === "paid") {
        await createGiveawayEntryFromSession(session);
      }
    } else if (session.metadata?.type === "gift_card") {
      if (session.payment_status === "paid") {
        await createGiftCardsFromSession(event, session);
      }
    } else {
      await updateWashBookingFromStripeSession(
        session,
        session.payment_status === "paid" ? "Paid" : "Processing Stripe payment"
      );
    }
  } else if (event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data?.object || {};
    if (session.metadata?.type === "competition_entry") {
      const processed = await processCompetitionStripeEvent({ ...event, type: "checkout.session.completed" }, requestEnvStorage.getStore() || {});
      if (!processed) return corsResponse(request, { ok: false, error: "Invalid competition payment event." }, 400);
    } else if (session.metadata?.type === "giveaway") {
      await createGiveawayEntryFromSession(session);
    } else if (session.metadata?.type === "gift_card") {
      await createGiftCardsFromSession(event, session);
    } else {
      await updateWashBookingFromStripeSession(session, "Paid");
    }
  } else if (event.type === "checkout.session.async_payment_failed") {
    await updateWashBookingFromStripeSession(event.data?.object || {}, "Stripe payment failed");
  } else if (event.type === "checkout.session.expired") {
    await updateWashBookingFromStripeSession(event.data?.object || {}, "Stripe checkout expired");
  }

  await giftCardDb()
    .prepare("INSERT OR IGNORE INTO gift_card_events (id, event_type, stripe_event_id, detail, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), cleanText(event.type, 120), cleanText(event.id, 120), "Webhook processed", new Date().toISOString())
    .run();

  return corsResponse(request, { ok: true });
}

async function createGiveawayEntryFromSession(session) {
  if (session.metadata?.type !== "giveaway" || session.payment_status !== "paid") return false;
  const amount = Number(session.amount_total || 0);
  const currency = String(session.currency || "").toUpperCase();
  const paymentId = cleanText(session.payment_intent, 180);
  const sessionId = cleanText(session.id, 180);
  if (amount !== 200 || currency !== "GBP" || !paymentId || !sessionId) return false;

  const firstName = publicText(session.metadata?.first_name, 80);
  const lastName = publicText(session.metadata?.last_name, 80);
  const email = cleanEmail(session.metadata?.email || session.customer_details?.email || session.customer_email);
  const phone = publicText(session.metadata?.phone, 40);
  if (!firstName || !lastName || !email) return false;

  const result = await giftCardDb().prepare(`INSERT OR IGNORE INTO giveaway_entries (
    first_name, last_name, email, phone, stripe_payment_id,
    stripe_checkout_session_id, amount, currency, payment_status, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, 200, 'GBP', 'Paid', ?)`)
    .bind(firstName, lastName, email, phone, paymentId, sessionId, new Date().toISOString())
    .run();
  return Number(result.meta?.changes || 0) > 0;
}

async function updateWashBookingFromStripeSession(session, status) {
  const bookingReference = cleanReference(
    session.client_reference_id || session.metadata?.booking_reference || ""
  );
  if (!bookingReference || !bookingReference.startsWith("BDW-")) return false;

  const now = new Date().toISOString();
  const paidAt = status === "Paid" ? now : null;
  const expiredAt = status === "Stripe checkout expired" ? now : null;
  const result = await giftCardDb().prepare(`UPDATE wash_bookings SET
    status = ?, stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id),
    stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id),
    stripe_payment_status = ?, updated_at = ?,
    paid_at = COALESCE(?, paid_at), expired_at = COALESCE(?, expired_at)
    WHERE booking_reference = ?`)
    .bind(
      status,
      cleanText(session.id, 180) || null,
      cleanText(session.payment_intent, 180) || null,
      cleanText(session.payment_status, 80),
      now, paidAt, expiredAt, bookingReference
    )
    .run();
  return Number(result.meta?.changes || 0) > 0;
}

async function createGiftCardsFromSession(event, session) {
  const existing = await giftCardDb()
    .prepare("SELECT id FROM gift_cards WHERE stripe_checkout_session_id = ? LIMIT 1")
    .bind(session.id)
    .first();

  if (existing) return;

  const metadata = session.metadata || {};
  const amount = Number.parseInt(metadata.gift_card_value || "0", 10);
  const quantity = Math.min(Math.max(Number.parseInt(metadata.quantity || "1", 10), 1), 10);
  const now = new Date().toISOString();
  const deliveryDate = cleanDeliveryDate(metadata.delivery_date);
  const statements = [];
  const createdCards = [];

  for (let index = 0; index < quantity; index += 1) {
    const card = {
      id: crypto.randomUUID(),
      code: await uniqueGiftCardCode(),
      originalAmount: amount,
      remainingBalance: amount,
      currency: "GBP",
      status: "Active",
      buyerName: cleanText(metadata.buyer_name, 120),
      buyerEmail: cleanEmail(metadata.buyer_email),
      recipientName: cleanText(metadata.recipient_name, 120),
      recipientEmail: cleanEmail(metadata.recipient_email),
      message: cleanText(metadata.message, 500),
      quantity,
      purchaseDate: now,
      deliveryDate,
      deliveredAt: "",
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: cleanText(session.payment_intent, 160),
      createdAt: now,
      updatedAt: now,
    };

    createdCards.push(card);
    statements.push(
      giftCardDb()
        .prepare(`INSERT INTO gift_cards (
          id, code, original_amount, remaining_balance, currency, status,
          buyer_name, buyer_email, recipient_name, recipient_email, message,
          quantity, purchase_date, delivery_date, delivered_at,
          stripe_checkout_session_id, stripe_payment_intent_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(
          card.id, card.code, card.originalAmount, card.remainingBalance, card.currency, card.status,
          card.buyerName, card.buyerEmail, card.recipientName, card.recipientEmail, card.message,
          card.quantity, card.purchaseDate, card.deliveryDate, card.deliveredAt,
          card.stripeCheckoutSessionId, card.stripePaymentIntentId, card.createdAt, card.updatedAt
        )
    );
  }

  statements.push(
    giftCardDb()
      .prepare("INSERT OR IGNORE INTO gift_card_events (id, event_type, stripe_event_id, detail, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), cleanText(event.type, 120), cleanText(event.id, 120), `Created ${createdCards.length} gift card(s)`, now)
  );

  await giftCardDb().batch(statements);
  const dueCards = createdCards.filter((card) => !card.deliveryDate || card.deliveryDate <= now.slice(0, 10));
  if (dueCards.length) {
    const sent = await sendGiftCardEmails(dueCards);
    if (sent) {
      for (const card of dueCards) {
        await markGiftCardDelivered(card.id, card.recipientEmail, "Immediate delivery email accepted by provider.");
      }
    }
  }
}

async function handleGiftCardBalance(request) {
  if (request.method !== "POST") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }

  if (!giftCardDb()) {
    return corsResponse(request, { ok: false, error: "Gift card balance service is not configured." }, 503);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return corsResponse(request, { ok: false, error: "Invalid JSON request." }, 400);
  }

  const code = cleanGiftCardCode(input.code);
  const recipientEmail = cleanEmail(input.recipientEmail);

  if (!code || !recipientEmail) {
    return corsResponse(request, { ok: false, error: "Enter a valid gift card code and recipient email." }, 400);
  }

  const card = await giftCardDb()
    .prepare("SELECT original_amount, remaining_balance, status FROM gift_cards WHERE code = ? AND recipient_email = ?")
    .bind(code, recipientEmail)
    .first();

  if (!card) {
    return corsResponse(request, { ok: false, error: "Gift card details could not be found." }, 404);
  }

  return corsResponse(request, {
    ok: true,
    originalAmountDisplay: formatMoney(card.original_amount),
    remainingBalanceDisplay: formatMoney(card.remaining_balance),
    status: card.status,
    expiryDate: "",
  });
}

async function handleAdminGiftCards(request, url) {
  if (!(await isAdminRequest(request))) {
    return corsResponse(request, { ok: false, error: "Admin authentication is required." }, 401);
  }

  if (!giftCardDb()) {
    return corsResponse(request, { ok: false, error: "Gift card database is not configured." }, 503);
  }

  if (request.method === "GET") {
    return adminGiftCardList(request, url);
  }

  if (request.method === "POST") {
    return adminGiftCardAction(request, url);
  }

  return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
}

async function handlePublicEtsyProducts(request, url) {
  if (request.method !== "GET") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }

  if (!envFlag("ETSY_FEATURE_ENABLED")) {
    return corsResponse(request, {
      ok: true,
      enabled: false,
      count: 0,
      products: [],
      note: "Etsy products are disabled."
    });
  }

  const keywords = cleanText(url.searchParams.get("q") || "dog grooming", 80);
  const limit = cleanLimit(url.searchParams.get("limit"), 24, 50);
  const listings = await fetchEtsyMarketplaceListings(keywords, limit);
  let hiddenListingIds = new Set();
  if (giftCardDb()) {
    const hidden = await giftCardDb()
      .prepare("SELECT external_listing_id FROM etsy_products WHERE source = 'etsy' AND admin_status IN ('hidden', 'unpublished', 'archived')")
      .all();
    hiddenListingIds = new Set((hidden.results || []).map((row) => String(row.external_listing_id)));
  }
  const products = listings
    .map(publicEtsyMarketplaceProductShape)
    .filter((product) => product.sourceProductId && product.name && product.externalUrl && !hiddenListingIds.has(String(product.sourceProductId)));
  return corsResponse(request, {
    ok: true,
    enabled: true,
    live: true,
    adminControlled: true,
    query: keywords,
    count: products.length,
    products
  });
}

async function fetchEtsyMarketplaceListings(keywords = "dog grooming", limit = 24) {
  const params = new URLSearchParams({
    keywords,
    limit: String(limit),
    sort_on: "score",
    sort_order: "desc",
    ship_to: "GB",
    includes: "Images,Shop"
  });
  const data = await etsyApi(`/v3/application/listings/active?${params.toString()}`);
  const searchResults = Array.isArray(data.results) ? data.results : [];
  const listingIds = searchResults
    .map((listing) => cleanText(listing.listing_id || listing.listingId, 40))
    .filter(Boolean);
  let listings = searchResults;
  if (listingIds.length) {
    const detailParams = new URLSearchParams({
      listing_ids: listingIds.join(","),
      includes: "Images,Shop",
      buyer_country: "GB",
      currency: "GBP"
    });
    const details = await etsyApi(`/v3/application/listings/batch?${detailParams.toString()}`);
    if (Array.isArray(details.results) && details.results.length) listings = details.results;
  }
  return listings;
}

function publicEtsyMarketplaceProductShape(listing) {
  const normalized = normalizeEtsyImport(listing, listing.shop_id || listing.shopId || "");
  const shop = listing.Shop || listing.shop || {};
  const category = normalized.category && !/^\d+$/.test(normalized.category)
    ? normalized.category
    : "Etsy Dog Products";
  return {
    id: `etsy-${normalized.externalListingId}`,
    source: "etsy",
    sourceProductId: normalized.externalListingId,
    name: normalized.title,
    category,
    price: Number.isFinite(normalized.price) ? normalized.price / 100 : null,
    priceLabel: Number.isFinite(normalized.price) ? formatPence(normalized.price, normalized.currency) : "Price on Etsy",
    icon: "ET",
    image: normalized.primaryImage || "retail.jpg",
    supplier: cleanText(shop.shop_name || shop.shopName || "Etsy", 120),
    commission: "External checkout",
    status: normalized.personalisationAvailable ? "Personalised Etsy product" : (normalized.availability || "External checkout"),
    externalUrl: normalized.listingUrl,
    description: normalized.description || "Etsy product.",
    personalised: Boolean(normalized.personalisationAvailable),
    paymentProvider: "Etsy"
  };
}

async function handleAdminEtsy(request, url) {
  if (!(await isAdminRequest(request))) {
    return corsResponse(request, { ok: false, error: "Admin authentication is required." }, 401);
  }

  if (!giftCardDb()) {
    return corsResponse(request, { ok: false, error: "Product database is not configured." }, 503);
  }

  if (request.method === "GET" && url.pathname === ADMIN_ETSY_PATH) {
    return adminEtsyDashboard(request);
  }

  if (request.method === "GET" && url.pathname === `${ADMIN_ETSY_PATH}/products`) {
    return adminEtsyProducts(request, url);
  }

  if (request.method === "GET" && url.pathname === `${ADMIN_ETSY_PATH}/logs`) {
    return adminEtsyLogs(request);
  }

  if (request.method !== "POST") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const action = cleanText(parts[3], 60);
  if (action === "test") return adminEtsyTestConnection(request);
  if (action === "sync") return adminEtsySyncNow(request);
  if (action === "disconnect") return adminEtsyDisconnect(request);
  if (action === "automatic-sync") return adminEtsyAutomaticSync(request);
  if (action === "retry") return adminEtsySyncNow(request);
  if (action === "products") return adminEtsyProductAction(request, cleanText(parts[4], 40));

  return corsResponse(request, { ok: false, error: "Unknown Etsy admin action." }, 404);
}

async function handleEtsyConnect(request) {
  if (!(await isAdminRequest(request))) {
    return corsResponse(request, { ok: false, error: "Admin authentication is required." }, 401);
  }

  if (!envFlag("ETSY_FEATURE_ENABLED")) {
    return corsResponse(request, { ok: false, error: "Etsy is disabled. Set ETSY_FEATURE_ENABLED=true before connecting." }, 403);
  }

  if (!giftCardDb()) {
    return corsResponse(request, { ok: false, error: "Product database is not configured." }, 503);
  }

  const clientId = envText("ETSY_API_KEY");
  const redirectUri = envText("ETSY_REDIRECT_URI") || "https://bingodogwash.com/api/etsy/callback";
  if (!clientId) {
    return corsResponse(request, { ok: false, error: "ETSY_API_KEY is not configured." }, 503);
  }

  const state = randomToken(32);
  const verifier = randomToken(64);
  const challenge = await pkceChallenge(verifier);
  const now = new Date().toISOString();
  await giftCardDb()
    .prepare(`INSERT INTO etsy_connections (id, status, oauth_state, pkce_verifier, created_at, updated_at)
      VALUES ('primary', 'Pending', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = 'Pending', oauth_state = excluded.oauth_state, pkce_verifier = excluded.pkce_verifier, updated_at = excluded.updated_at`)
    .bind(state, verifier, now, now)
    .run();

  await auditSiteEvent(request, "etsy-connect-start", "etsy_connection", "primary", "", "Pending", "ok", "");
  const authUrl = new URL("https://www.etsy.com/oauth/connect");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "listings_r shops_r");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  return corsResponse(request, { ok: true, connectUrl: authUrl.toString() });
}

async function handleEtsyCallback(request, url) {
  if (!envFlag("ETSY_FEATURE_ENABLED")) {
    return etsyHtmlResponse("Etsy disabled", "Etsy is disabled. No connection was changed.", 403);
  }

  if (!giftCardDb()) {
    return etsyHtmlResponse("Etsy unavailable", "The product database is not configured.", 503);
  }

  const error = cleanText(url.searchParams.get("error_description") || url.searchParams.get("error"), 300);
  const code = cleanText(url.searchParams.get("code"), 500);
  const state = cleanText(url.searchParams.get("state"), 160);
  const connection = await etsyConnection();
  if (error || !code || !state || !connection?.oauth_state || state !== connection.oauth_state) {
    await auditSiteEvent(request, "etsy-connect-callback", "etsy_connection", "primary", "Pending", "Error", "error", error || "Invalid OAuth callback state.");
    return etsyHtmlResponse("Etsy connection failed", error || "Invalid Etsy callback state.", 400);
  }

  try {
    const token = await requestEtsyToken({
      grant_type: "authorization_code",
      code,
      code_verifier: connection.pkce_verifier,
      redirect_uri: envText("ETSY_REDIRECT_URI") || "https://bingodogwash.com/api/etsy/callback"
    });
    await saveEtsyToken(token, "Connected");
    await auditSiteEvent(request, "etsy-connect-complete", "etsy_connection", "primary", "Pending", "Connected", "ok", "");
    return etsyHtmlResponse("Etsy connected", "Etsy is connected. Products will still import as review-only until you approve and publish them.", 200);
  } catch (callbackError) {
    await auditSiteEvent(request, "etsy-connect-callback", "etsy_connection", "primary", "Pending", "Error", "error", callbackError.message);
    return etsyHtmlResponse("Etsy connection failed", callbackError.message || "Etsy token exchange failed.", 502);
  }
}

async function adminEtsyDashboard(request) {
  const [connection, counts, latestSync, latestErrors] = await Promise.all([
    etsyConnection(),
    etsyProductCounts(),
    latestEtsySync(),
    etsySyncErrorCount()
  ]);

  return corsResponse(request, {
    ok: true,
    featureEnabled: envFlag("ETSY_FEATURE_ENABLED"),
    syncEnabled: envFlag("ETSY_SYNC_ENABLED"),
    connection: etsyConnectionShape(connection, counts, latestSync, latestErrors)
  });
}

async function adminEtsyProducts(request, url) {
  const status = cleanText(url.searchParams.get("status"), 40);
  const values = [];
  let where = "WHERE source = 'etsy'";
  if (status) {
    where += " AND admin_status = ?";
    values.push(status);
  }

  const result = await giftCardDb()
    .prepare(`SELECT * FROM etsy_products ${where} ORDER BY updated_at DESC LIMIT 200`)
    .bind(...values)
    .all();

  return corsResponse(request, { ok: true, products: (result.results || []).map(adminEtsyProductShape) });
}

async function adminEtsyLogs(request) {
  const result = await giftCardDb()
    .prepare("SELECT * FROM etsy_sync_runs ORDER BY started_at DESC LIMIT 50")
    .all();
  return corsResponse(request, { ok: true, logs: result.results || [] });
}

async function adminEtsyTestConnection(request) {
  if (!envFlag("ETSY_FEATURE_ENABLED")) {
    return corsResponse(request, { ok: false, error: "Etsy is disabled." }, 403);
  }

  try {
    const listings = await fetchEtsyMarketplaceListings("dog grooming", 1);
    if (!listings.length) throw new Error("Etsy returned no marketplace listings.");
    await auditSiteEvent(request, "etsy-test-connection", "etsy_connection", "primary", "", "Connected", "ok", "");
    return corsResponse(request, { ok: true, message: "Etsy connection test passed." });
  } catch (error) {
    await auditSiteEvent(request, "etsy-test-connection", "etsy_connection", "primary", "", "Error", "error", error.message);
    return corsResponse(request, { ok: false, error: error.message || "Etsy connection test failed." }, 502);
  }
}

async function adminEtsySyncNow(request) {
  if (!envFlag("ETSY_FEATURE_ENABLED")) {
    return corsResponse(request, { ok: false, error: "Etsy is disabled." }, 403);
  }

  if (!envFlag("ETSY_SYNC_ENABLED")) {
    await auditSiteEvent(request, "etsy-manual-sync", "etsy_connection", "primary", "", "Skipped", "error", "ETSY_SYNC_ENABLED is false.");
    return corsResponse(request, { ok: false, error: "Etsy syncing is disabled. Set ETSY_SYNC_ENABLED=true to run imports." }, 403);
  }

  const result = await runEtsySync("manual", adminActor(request));
  return corsResponse(request, { ok: result.status === "success", sync: result }, result.status === "success" ? 200 : 502);
}

async function adminEtsyDisconnect(request) {
  const previous = await etsyConnection();
  const now = new Date().toISOString();
  await giftCardDb()
    .prepare("UPDATE etsy_connections SET status = 'Disconnected', access_token = '', refresh_token = '', token_expires_at = '', oauth_state = '', pkce_verifier = '', disconnected_at = ?, updated_at = ? WHERE id = 'primary'")
    .bind(now, now)
    .run();
  await auditSiteEvent(request, "etsy-disconnect", "etsy_connection", "primary", previous?.status || "", "Disconnected", "ok", "");
  return corsResponse(request, { ok: true });
}

async function adminEtsyAutomaticSync(request) {
  let input = {};
  try { input = await request.json(); } catch {}
  const enabled = input.enabled === true;
  const now = new Date().toISOString();
  await giftCardDb()
    .prepare(`INSERT INTO etsy_connections (id, status, automatic_sync_enabled, created_at, updated_at)
      VALUES ('primary', 'Disconnected', ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET automatic_sync_enabled = excluded.automatic_sync_enabled, updated_at = excluded.updated_at`)
    .bind(enabled ? 1 : 0, now, now)
    .run();
  await auditSiteEvent(request, enabled ? "etsy-auto-sync-enable" : "etsy-auto-sync-pause", "etsy_connection", "primary", "", String(enabled), "ok", "");
  return corsResponse(request, { ok: true, automaticSyncEnabled: enabled });
}

async function adminEtsyProductAction(request, action) {
  let input = {};
  try { input = await request.json(); } catch {}
  const ids = Array.isArray(input.ids) ? input.ids.map((id) => cleanText(id, 120)).filter(Boolean) : [];
  if (!ids.length) {
    return corsResponse(request, { ok: false, error: "Select at least one Etsy product." }, 400);
  }

  const updates = {
    approve: { status: "approved", visibility: 0, audit: "etsy-product-approve" },
    publish: { status: "published", visibility: 1, audit: "etsy-product-publish" },
    hide: { status: "hidden", visibility: 0, audit: "etsy-product-hide" },
    unpublish: { status: "unpublished", visibility: 0, audit: "etsy-product-unpublish" },
    archive: { status: "archived", visibility: 0, audit: "etsy-product-archive" }
  };
  const update = updates[action];
  if (!update) {
    return corsResponse(request, { ok: false, error: "Unknown Etsy product action." }, 400);
  }

  const placeholders = ids.map(() => "?").join(",");
  await giftCardDb()
    .prepare(`UPDATE etsy_products SET admin_status = ?, public_visibility = ?, updated_at = ? WHERE id IN (${placeholders}) AND source = 'etsy'`)
    .bind(update.status, update.visibility, new Date().toISOString(), ...ids)
    .run();
  await auditSiteEvent(request, update.audit, "etsy_product", ids.join(","), "", update.status, "ok", "");
  return corsResponse(request, { ok: true, status: update.status, publicVisibility: Boolean(update.visibility) });
}

async function runEtsySync(syncType, actor) {
  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  await giftCardDb()
    .prepare("INSERT INTO etsy_sync_runs (id, sync_type, status, started_at, created_by) VALUES (?, ?, 'running', ?, ?)")
    .bind(runId, syncType, now, cleanText(actor, 120))
    .run();

  let attempted = 0;
  let imported = 0;
  let updated = 0;
  let failed = 0;
  try {
    const listings = await fetchEtsyMarketplaceListings("dog grooming", 100);
    attempted = listings.length;

    for (const listing of listings) {
      try {
        const result = await upsertEtsyListing(listing, listing.shop_id || listing.shopId || "");
        if (result === "imported") imported += 1;
        else updated += 1;
      } catch (error) {
        failed += 1;
        await giftCardDb()
          .prepare("INSERT INTO etsy_sync_errors (id, sync_run_id, external_listing_id, error_message, raw_source_payload, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(crypto.randomUUID(), runId, cleanText(listing.listing_id, 80), cleanText(error.message, 500), JSON.stringify(listing).slice(0, 12000), new Date().toISOString())
          .run();
      }
    }

    const finished = new Date().toISOString();
    await giftCardDb().batch([
      giftCardDb().prepare("UPDATE etsy_sync_runs SET status = 'success', finished_at = ?, attempted_count = ?, imported_count = ?, updated_count = ?, failed_count = ? WHERE id = ?")
        .bind(finished, attempted, imported, updated, failed, runId),
      giftCardDb().prepare("UPDATE etsy_connections SET status = 'Connected', last_successful_sync_at = ?, last_attempted_sync_at = ?, last_error = '', updated_at = ? WHERE id = 'primary'")
        .bind(finished, finished, finished)
    ]);
    await auditSiteEvent(null, syncType === "scheduled" ? "etsy-scheduled-sync" : "etsy-manual-sync", "etsy_sync_run", runId, "", "success", "ok", "");
    return { id: runId, status: "success", attempted, imported, updated, failed };
  } catch (error) {
    const finished = new Date().toISOString();
    await giftCardDb().batch([
      giftCardDb().prepare("UPDATE etsy_sync_runs SET status = 'error', finished_at = ?, attempted_count = ?, imported_count = ?, updated_count = ?, failed_count = ?, error_message = ? WHERE id = ?")
        .bind(finished, attempted, imported, updated, failed, cleanText(error.message, 500), runId),
      giftCardDb().prepare("UPDATE etsy_connections SET last_attempted_sync_at = ?, last_error = ?, updated_at = ? WHERE id = 'primary'")
        .bind(finished, cleanText(error.message, 500), finished)
    ]);
    await auditSiteEvent(null, syncType === "scheduled" ? "etsy-scheduled-sync" : "etsy-manual-sync", "etsy_sync_run", runId, "", "error", "error", error.message);
    return { id: runId, status: "error", attempted, imported, updated, failed, error: error.message };
  }
}

async function upsertEtsyListing(listing, shopId) {
  const product = normalizeEtsyImport(listing, shopId);
  if (!product.externalListingId || !product.title || !product.listingUrl) {
    throw new Error("Etsy listing is missing required id, title or URL.");
  }

  const existing = await giftCardDb()
    .prepare("SELECT id FROM etsy_products WHERE source = 'etsy' AND external_listing_id = ?")
    .bind(product.externalListingId)
    .first();
  const now = new Date().toISOString();
  if (existing) {
    await giftCardDb()
      .prepare(`UPDATE etsy_products SET etsy_shop_id = ?, title = ?, description = ?, price = ?, currency = ?, quantity = ?, availability = ?, state = ?, listing_url = ?, primary_image = ?, additional_images = ?, tags = ?, category = ?, personalisation_available = ?, variations = ?, created_time = ?, updated_time = ?, last_synced_at = ?, sync_error = '', raw_source_payload = ?, updated_at = ? WHERE id = ? AND source = 'etsy'`)
      .bind(product.shopId, product.title, product.description, product.price, product.currency, product.quantity, product.availability, product.state, product.listingUrl, product.primaryImage, product.additionalImages, product.tags, product.category, product.personalisationAvailable, product.variations, product.createdTime, product.updatedTime, now, product.raw, now, existing.id)
      .run();
    return "updated";
  }

  await giftCardDb()
    .prepare(`INSERT INTO etsy_products (id, source, external_listing_id, etsy_shop_id, title, display_title, description, display_description, price, currency, quantity, availability, state, listing_url, primary_image, additional_images, tags, category, personalisation_available, variations, created_time, updated_time, last_synced_at, admin_status, public_visibility, sync_error, raw_source_payload, created_at, updated_at)
      VALUES (?, 'etsy', ?, ?, ?, '', ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 1, '', ?, ?, ?)`)
    .bind(crypto.randomUUID(), product.externalListingId, product.shopId, product.title, product.description, product.price, product.currency, product.quantity, product.availability, product.state, product.listingUrl, product.primaryImage, product.additionalImages, product.tags, product.category, product.personalisationAvailable, product.variations, product.createdTime, product.updatedTime, now, product.raw, now, now)
    .run();
  return "imported";
}

function normalizeEtsyImport(listing, shopId) {
  const price = normalizeEtsyPrice(listing.price);
  const images = etsyListingImages(listing);
  const tags = Array.isArray(listing.tags) ? listing.tags.map((tag) => cleanText(tag, 80)).filter(Boolean) : [];
  const rawCategory = cleanText(Array.isArray(listing.taxonomy_path) ? listing.taxonomy_path[0] : firstValue(listing.category, listing.taxonomy_id, "Etsy Dog Products"), 120);
  const category = rawCategory && !/^\d+$/.test(rawCategory) ? rawCategory : "Etsy Dog Products";
  return {
    externalListingId: cleanText(listing.listing_id || listing.listingId || listing.id, 80),
    shopId: cleanText(listing.shop_id || listing.shopId || shopId, 80),
    title: sanitizeExternalText(listing.title, 240),
    description: sanitizeExternalText(listing.description, 4000),
    price: price.amount,
    currency: cleanText(price.currency || listing.currency_code || "GBP", 12).toUpperCase(),
    quantity: normalizeStock(firstValue(listing.quantity, listing.inventory, 1)),
    availability: listing.state === "active" ? "In stock" : cleanText(listing.state || "Unknown", 80),
    state: cleanText(listing.state || "active", 40),
    listingUrl: cleanEtsyUrl(firstValue(listing.url, listing.listing_url)),
    primaryImage: images[0] || "",
    additionalImages: JSON.stringify(images.slice(1)),
    tags: JSON.stringify(tags),
    category,
    personalisationAvailable: listing.is_personalizable || listing.personalization_is_required ? 1 : 0,
    variations: JSON.stringify(listing.variations || listing.property_values || []),
    createdTime: etsyTime(listing.created_timestamp || listing.creation_tsz || listing.created_time),
    updatedTime: etsyTime(listing.updated_timestamp || listing.ending_tsz || listing.updated_time),
    raw: JSON.stringify(listing).slice(0, 12000)
  };
}

function normalizeEtsyPrice(price) {
  if (price && typeof price === "object") {
    const amount = Number(price.amount);
    const divisor = Number(price.divisor || 100);
    return {
      amount: Number.isFinite(amount) && divisor ? Math.round((amount / divisor) * 100) : null,
      currency: price.currency_code || price.currency
    };
  }
  const parsed = normalizeMoney(price);
  return { amount: Number.isFinite(parsed) ? Math.round(parsed * 100) : null, currency: "" };
}

function etsyListingImages(listing) {
  return imageValues(firstValue(listing.images, listing.Images, listing.image, listing.image_url, listing.imageUrl))
    .map((value) => cleanImageUrl(value, ""))
    .filter((value) => value.startsWith("https://i.etsystatic.com/") || value.startsWith("https://img0.etsystatic.com/"));
}

function etsyTime(value) {
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return new Date(number * 1000).toISOString();
  return cleanText(value, 40);
}

function cleanEtsyUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.hostname.endsWith("etsy.com") && url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function sanitizeExternalText(value, maxLength = 1000) {
  return cleanMultilineText(value, maxLength).replace(/[<>]/g, "");
}

async function validEtsyAccessToken() {
  const connection = await etsyConnection();
  if (!connection?.access_token) throw new Error("Etsy is not connected.");
  const expires = Date.parse(connection.token_expires_at || "");
  if (Number.isFinite(expires) && expires > Date.now() + 120000) {
    return connection.access_token;
  }
  if (!connection.refresh_token) throw new Error("Etsy refresh token is missing.");
  const token = await requestEtsyToken({ grant_type: "refresh_token", refresh_token: connection.refresh_token });
  await saveEtsyToken(token, "Connected");
  return token.access_token;
}

async function requestEtsyToken(params) {
  const clientId = envText("ETSY_API_KEY");
  if (!clientId) throw new Error("ETSY_API_KEY is not configured.");
  const body = new URLSearchParams({ client_id: clientId, ...params });
  const response = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(cleanText(data.error_description || data.error || "Etsy token request failed.", 300));
  }
  return data;
}

async function saveEtsyToken(token, status) {
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString();
  await giftCardDb()
    .prepare(`INSERT INTO etsy_connections (id, status, access_token, refresh_token, token_type, token_expires_at, scope, shop_id, shop_name, connected_at, oauth_state, pkce_verifier, created_at, updated_at)
      VALUES ('primary', ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, access_token = excluded.access_token, refresh_token = excluded.refresh_token, token_type = excluded.token_type, token_expires_at = excluded.token_expires_at, scope = excluded.scope, shop_id = excluded.shop_id, shop_name = excluded.shop_name, connected_at = COALESCE(etsy_connections.connected_at, excluded.connected_at), oauth_state = '', pkce_verifier = '', updated_at = excluded.updated_at`)
    .bind(status, cleanText(token.access_token, 2000), cleanText(token.refresh_token, 2000), cleanText(token.token_type || "Bearer", 40), expiresAt, cleanText(token.scope, 500), etsyShopId(), envText("ETSY_SHOP_NAME"), now, now, now)
    .run();
}

async function etsyApi(path, token = "") {
  const apiKey = envText("ETSY_API_KEY");
  const apiSecret = envText("ETSY_API_SECRET");
  if (!apiKey) throw new Error("ETSY_API_KEY is not configured.");
  const headers = new Headers({ Accept: "application/json" });
  headers.set("x-api-key", apiSecret ? `${apiKey}:${apiSecret}` : apiKey);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`https://api.etsy.com${path}`, { headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(cleanText(data.error || data.message || `Etsy API returned ${response.status}.`, 300));
  }
  return data;
}

function etsyShopId() {
  return cleanText(envText("ETSY_SHOP_ID"), 80);
}

async function etsyConnection() {
  return giftCardDb()
    ? giftCardDb().prepare("SELECT * FROM etsy_connections WHERE id = 'primary'").first()
    : null;
}

async function etsyProductCounts() {
  const result = await giftCardDb()
    .prepare("SELECT admin_status, public_visibility, COUNT(*) AS count FROM etsy_products WHERE source = 'etsy' GROUP BY admin_status, public_visibility")
    .all();
  const counts = { imported: 0, review: 0, approved: 0, published: 0, hidden: 0, unpublished: 0, error: 0, archived: 0 };
  for (const row of result.results || []) {
    counts.imported += Number(row.count) || 0;
    counts[row.admin_status] = (counts[row.admin_status] || 0) + (Number(row.count) || 0);
  }
  return counts;
}

async function latestEtsySync() {
  return giftCardDb().prepare("SELECT * FROM etsy_sync_runs ORDER BY started_at DESC LIMIT 1").first();
}

async function etsySyncErrorCount() {
  const row = await giftCardDb().prepare("SELECT COUNT(*) AS count FROM etsy_sync_errors").first();
  return Number(row?.count) || 0;
}

function etsyConnectionShape(connection, counts, latestSync, syncErrors) {
  return {
    status: envText("ETSY_API_KEY") ? "API ready" : "Not configured",
    shopId: connection?.shop_id || etsyShopId(),
    shopName: connection?.shop_name || envText("ETSY_SHOP_NAME") || "Etsy marketplace feed",
    lastSuccessfulSync: connection?.last_successful_sync_at || "",
    lastAttemptedSync: connection?.last_attempted_sync_at || latestSync?.started_at || "",
    importedProducts: counts.imported || 0,
    awaitingReview: counts.review || 0,
    approved: counts.approved || 0,
    published: counts.published || 0,
    hidden: counts.hidden || 0,
    syncErrors,
    automaticSyncEnabled: false,
    lastError: connection?.last_error || latestSync?.error_message || ""
  };
}

function adminEtsyProductShape(product) {
  const category = product.category && !/^\d+$/.test(String(product.category))
    ? product.category
    : "Etsy Dog Products";
  return {
    id: product.id,
    externalListingId: product.external_listing_id,
    title: product.display_title || product.title,
    category,
    price: product.price,
    priceLabel: formatPence(product.price, product.currency),
    currency: product.currency || "GBP",
    quantity: product.quantity,
    availability: product.availability || product.state || "",
    status: product.admin_status,
    publicVisibility: Boolean(product.public_visibility),
    listingUrl: product.listing_url,
    image: product.primary_image,
    personalisationAvailable: Boolean(product.personalisation_available),
    syncError: product.sync_error || "",
    lastSyncedAt: product.last_synced_at || ""
  };
}

function publicEtsyProductShape(product) {
  return {
    id: `etsy-${product.external_listing_id}`,
    source: "etsy",
    sourceProductId: product.external_listing_id,
    name: product.display_title || product.title,
    category: product.category || "Etsy Products",
    price: product.price ? product.price / 100 : null,
    priceLabel: product.price ? formatPence(product.price, product.currency) : "Price on Etsy",
    icon: "ET",
    image: product.primary_image || "retail.jpg",
    supplier: "Etsy",
    commission: "External checkout",
    status: product.personalisation_available ? "Personalised Etsy product" : (product.availability || "External checkout"),
    externalUrl: product.listing_url,
    description: product.display_description || product.description || "Etsy product.",
    personalised: Boolean(product.personalisation_available),
    paymentProvider: "Etsy"
  };
}

function formatPence(pence, currency = "GBP") {
  const amount = Number(pence);
  if (!Number.isFinite(amount)) return "Price on Etsy";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: currency || "GBP" }).format(amount / 100);
}

async function handleAdminPages(request, url) {
  if (!(await isAdminRequest(request))) {
    return corsResponse(request, { ok: false, error: "Admin authentication is required." }, 401);
  }

  if (!giftCardDb()) {
    return corsResponse(request, { ok: false, error: "Page database is not configured." }, 503);
  }

  if (request.method === "GET") {
    const result = await giftCardDb().prepare("SELECT * FROM site_pages ORDER BY protected_page DESC, page_name ASC").all();
    return corsResponse(request, { ok: true, pages: (result.results || []).map(adminPageShape) });
  }

  if (request.method !== "POST") {
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const pageId = cleanReference(parts[3] || "");
  const action = cleanText(parts[4], 40);
  if (!pageId || !action) {
    return corsResponse(request, { ok: false, error: "Page and action are required." }, 400);
  }

  let input = {};
  try { input = await request.json(); } catch {}
  return adminPageAction(request, pageId, action, input);
}

async function adminPageAction(request, pageId, action, input) {
  const page = await giftCardDb().prepare("SELECT * FROM site_pages WHERE id = ?").bind(pageId).first();
  if (!page) return corsResponse(request, { ok: false, error: "Page not found." }, 404);
  if (page.protected_page && ["pause", "draft"].includes(action)) {
    return corsResponse(request, { ok: false, error: "Protected pages cannot be paused or drafted." }, 400);
  }
  if (action === "pause" && input.confirm !== true) {
    return corsResponse(request, { ok: false, error: "Confirm before pausing a page." }, 400);
  }

  const statusByAction = {
    live: "live",
    draft: "draft",
    pause: "paused",
    restore: "live",
    schedule: "scheduled"
  };
  const status = statusByAction[action];
  if (!status && action !== "redirect") {
    return corsResponse(request, { ok: false, error: "Unknown page action." }, 400);
  }

  const previous = JSON.stringify(adminPageShape(page));
  const now = new Date().toISOString();
  if (action === "redirect") {
    const redirectTarget = cleanText(input.redirectTarget, 200);
    await giftCardDb().prepare("UPDATE site_pages SET redirect_target = ?, last_updated = ? WHERE id = ?").bind(redirectTarget, now, pageId).run();
  } else {
    await giftCardDb()
      .prepare("UPDATE site_pages SET status = ?, included_in_navigation = ?, scheduled_publish_at = ?, redirect_target = COALESCE(?, redirect_target), last_updated = ? WHERE id = ?")
      .bind(status, status === "live" ? 1 : 0, cleanText(input.scheduledPublishAt, 40), cleanText(input.redirectTarget, 200) || null, now, pageId)
      .run();
  }

  const updated = await giftCardDb().prepare("SELECT * FROM site_pages WHERE id = ?").bind(pageId).first();
  await auditSiteEvent(request, `page-${action}`, "site_page", pageId, previous, JSON.stringify(adminPageShape(updated)), "ok", "");
  return corsResponse(request, { ok: true, page: adminPageShape(updated) });
}

function adminPageShape(page) {
  return {
    id: page.id,
    pageName: page.page_name,
    route: page.route,
    status: page.status,
    includedInNavigation: Boolean(page.included_in_navigation),
    protectedPage: Boolean(page.protected_page),
    scheduledPublishAt: page.scheduled_publish_at || "",
    redirectTarget: page.redirect_target || "",
    lastUpdated: page.last_updated || ""
  };
}

async function auditSiteEvent(request, action, targetType, targetId, previousValue, newValue, result, errorMessage) {
  if (!giftCardDb()) return;
  await giftCardDb()
    .prepare("INSERT INTO site_audit_events (id, actor, action, target_type, target_id, previous_value, new_value, result, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), request ? adminActor(request) : "system", cleanText(action, 120), cleanText(targetType, 80), cleanText(targetId, 200), cleanText(previousValue, 1000), cleanText(newValue, 1000), cleanText(result, 40), cleanText(errorMessage, 500), new Date().toISOString())
    .run();
}

function envFlag(name) {
  return flagValue(envText(name));
}

function flagValue(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function randomToken(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function base64Url(bytes) {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function etsyHtmlResponse(title, message, status) {
  return new Response(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} | Bingo Dog Wash</title><link rel="stylesheet" href="/styles.css"></head><body><main class="container"><section class="page-title"><span class="eyebrow">Etsy</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><div class="button-row"><a class="btn btn-primary" href="https://admin.bingodogwash.com/admin">Back to admin</a></div></section></main></body></html>`, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
  });
}

async function adminGiftCardList(request, url) {
  const query = cleanText(url.searchParams.get("q"), 120);
  const status = cleanText(url.searchParams.get("status"), 40);
  const filters = [];
  const values = [];

  if (query) {
    filters.push("(code LIKE ? OR buyer_email LIKE ? OR recipient_email LIKE ?)");
    values.push(`%${query}%`, `%${query.toLowerCase()}%`, `%${query.toLowerCase()}%`);
  }

  if (status) {
    filters.push("status = ?");
    values.push(status);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const result = await giftCardDb()
    .prepare(`SELECT * FROM gift_cards ${where} ORDER BY created_at DESC LIMIT 100`)
    .bind(...values)
    .all();

  return corsResponse(request, {
    ok: true,
    giftCards: (result.results || []).map(adminGiftCardShape),
  });
}

async function adminGiftCardAction(request, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const code = cleanGiftCardCode(parts[3] || "");
  const action = cleanText(parts[4], 40);

  if (!code || !action) {
    return corsResponse(request, { ok: false, error: "Gift card code and action are required." }, 400);
  }

  let input = {};
  try {
    input = await request.json();
  } catch {}

  const card = await giftCardDb()
    .prepare("SELECT * FROM gift_cards WHERE code = ?")
    .bind(code)
    .first();

  if (!card) {
    return corsResponse(request, { ok: false, error: "Gift card was not found." }, 404);
  }

  if (action === "redeem") {
    return adminRedeemGiftCard(request, card, input);
  }

  if (action === "cancel" || action === "reactivate") {
    const status = action === "cancel" ? "Cancelled" : statusFromBalance(card.remaining_balance, card.original_amount);
    await giftCardDb()
      .prepare("UPDATE gift_cards SET status = ?, updated_at = ? WHERE id = ?")
      .bind(status, new Date().toISOString(), card.id)
      .run();
    await auditGiftCard(card.id, action, `Admin set status to ${status}.`);
    return corsResponse(request, { ok: true });
  }

  if (action === "resend") {
    const sent = await sendGiftCardEmails([dbCardToEmailCard(card)], { force: true });
    if (!sent) {
      return corsResponse(request, { ok: false, error: "Gift card email could not be sent. It remains queued for retry." }, 502);
    }
    await markGiftCardDelivered(card.id, card.recipient_email, "Admin resend email accepted by provider.");
    await auditGiftCard(card.id, action, "Admin requested gift card email resend.");
    return corsResponse(request, { ok: true });
  }

  return corsResponse(request, { ok: false, error: "Unknown gift card action." }, 400);
}

async function adminRedeemGiftCard(request, card, input) {
  const amountPounds = Number(input.amount);
  const amount = Math.round(amountPounds * 100);
  const now = new Date().toISOString();

  if (!Number.isFinite(amountPounds) || amount <= 0) {
    return corsResponse(request, { ok: false, error: "Enter a valid redemption amount." }, 400);
  }

  if (card.status === "Cancelled" || card.status === "Expired" || card.status === "Redeemed") {
    return corsResponse(request, { ok: false, error: "This gift card cannot be redeemed." }, 400);
  }

  if (amount > card.remaining_balance) {
    return corsResponse(request, { ok: false, error: "Redemption amount is greater than the remaining balance." }, 400);
  }

  const newBalance = card.remaining_balance - amount;
  const newStatus = newBalance === 0 ? "Redeemed" : "Partially Used";
  const update = await giftCardDb()
    .prepare("UPDATE gift_cards SET remaining_balance = ?, status = ?, updated_at = ? WHERE id = ? AND remaining_balance = ? AND status NOT IN ('Cancelled', 'Expired', 'Redeemed')")
    .bind(newBalance, newStatus, now, card.id, card.remaining_balance)
    .run();

  if (!update.success || Number(update.meta?.changes || 0) !== 1) {
    return corsResponse(request, { ok: false, error: "Gift card balance changed. Please refresh and try again." }, 409);
  }

  await giftCardDb()
    .prepare("INSERT INTO gift_card_redemptions (id, gift_card_id, amount, previous_balance, new_balance, reference, redeemed_by, redeemed_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(
      crypto.randomUUID(),
      card.id,
      amount,
      card.remaining_balance,
      newBalance,
      cleanText(input.reference, 160),
      adminActor(request),
      now,
      cleanText(input.notes, 500)
    )
    .run();

  await auditGiftCard(card.id, "redeem", `Redeemed ${formatMoney(amount)}.`);
  return corsResponse(request, { ok: true, remainingBalanceDisplay: formatMoney(newBalance), status: newStatus });
}

async function handleProfessionals(request, url) {
  if (!giftCardDb()) {
    return corsResponse(request, { ok: false, error: "Professional network database is not configured." }, 503);
  }

  if (url.pathname === `${PROFESSIONALS_PATH}/stats` && request.method === "GET") {
    return professionalStats(request);
  }

  if (url.pathname === PROFESSIONAL_APPLICATIONS_PATH && request.method === "POST") {
    return createProfessionalApplication(request);
  }

  if (url.pathname === PROFESSIONAL_APPLICATION_STATUS_PATH && request.method === "GET") {
    return professionalApplicationStatus(request, url);
  }

  if (url.pathname === PROFESSIONAL_DIRECTORY_PATH && request.method === "GET") {
    return professionalDirectory(request, url);
  }

  if (url.pathname === PROFESSIONAL_PROFILE_PATH && request.method === "GET") {
    return professionalProfile(request, url);
  }

  if (url.pathname === PROFESSIONAL_ENQUIRIES_PATH && request.method === "POST") {
    return createProfessionalEnquiry(request);
  }

  return corsResponse(request, { ok: false, error: "Professional network route not found." }, 404);
}

async function handleAdminProfessionals(request, url) {
  if (!(await isAdminRequest(request))) {
    return corsResponse(request, { ok: false, error: "Admin authentication is required." }, 401);
  }

  if (!giftCardDb()) {
    return corsResponse(request, { ok: false, error: "Professional network database is not configured." }, 503);
  }

  if (url.pathname === `${ADMIN_PROFESSIONALS_PATH}/stats` && request.method === "GET") {
    return adminProfessionalStats(request);
  }

  if (url.pathname === `${ADMIN_PROFESSIONALS_PATH}/applications`) {
    if (request.method === "GET") return adminProfessionalApplications(request, url);
    return corsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }

  if (url.pathname.startsWith(`${ADMIN_PROFESSIONALS_PATH}/applications/`) && request.method === "POST") {
    return adminProfessionalApplicationAction(request, url);
  }

  if (url.pathname === `${ADMIN_PROFESSIONALS_PATH}/members` && request.method === "GET") {
    return adminProfessionalMembers(request, url);
  }

  if (url.pathname === `${ADMIN_PROFESSIONALS_PATH}/enquiries` && request.method === "GET") {
    return adminProfessionalEnquiries(request, url);
  }

  if (url.pathname === `${ADMIN_PROFESSIONALS_PATH}/rewards` && request.method === "POST") {
    return adminProfessionalReward(request);
  }

  return corsResponse(request, { ok: false, error: "Admin professional route not found." }, 404);
}

async function professionalStats(request) {
  const founding = await giftCardDb()
    .prepare("SELECT COUNT(*) AS count FROM professional_members WHERE founding_member = 1 AND professional_type = 'Dog walker' AND status = 'Active'")
    .first();
  const pending = await giftCardDb()
    .prepare("SELECT COUNT(*) AS count FROM professional_applications WHERE status IN ('Pending', 'Under review', 'More information required')")
    .first();

  return corsResponse(request, {
    ok: true,
    foundingApproved: Number(founding?.count || 0),
    foundingLimit: 100,
    applicationsInReview: Number(pending?.count || 0),
  });
}

async function createProfessionalApplication(request) {
  const input = await readJson(request);
  if (!input) return corsResponse(request, { ok: false, error: "Invalid JSON request." }, 400);

  const application = normalizeProfessionalApplication(input);
  const errors = validateProfessionalApplication(application);

  if (errors.length) {
    return corsResponse(request, { ok: false, error: "Check the highlighted fields.", errors }, 400);
  }

  const existing = await giftCardDb()
    .prepare("SELECT id, status FROM professional_applications WHERE email = ?")
    .bind(application.email)
    .first();

  if (existing) {
    return corsResponse(request, {
      ok: false,
      error: "An application already exists for this email address.",
      duplicate: true,
      status: existing.status,
    }, 409);
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  try {
    await giftCardDb()
      .prepare(`INSERT INTO professional_applications (
        id, full_name, email, phone, business_name, business_postcode,
        professional_type, areas_covered, website, social_profile, years_experience,
        business_description, services_offered, insurance_status, dbs_status,
        privacy_consent, marketing_consent, privacy_policy_version, referred_by_code,
        status, publication_status, created_at, updated_at, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 'Unpublished', ?, ?, ?)`)
      .bind(
        id,
        application.fullName,
        application.email,
        application.phone,
        application.businessName,
        application.businessPostcode,
        application.professionalType,
        application.areasCovered,
        application.website,
        application.socialProfile,
        application.yearsExperience,
        application.businessDescription,
        application.servicesOffered,
        application.insuranceStatus,
        application.dbsStatus,
        application.privacyConsent ? 1 : 0,
        application.marketingConsent ? 1 : 0,
        application.privacyPolicyVersion,
        application.referredByCode,
        now,
        now,
        now
      )
      .run();
  } catch (error) {
    console.error("Professional application insert failed", { reason: error?.message || "unknown" });
    return corsResponse(request, { ok: false, error: "Application could not be saved. Please try again." }, 500);
  }

  if (application.referredByCode) {
    const member = await giftCardDb()
      .prepare("SELECT id FROM professional_members WHERE referral_code = ? AND email != ?")
      .bind(application.referredByCode, application.email)
      .first();
    await giftCardDb()
      .prepare(`INSERT INTO professional_referrals (
        id, referring_member_id, referral_code, referred_application_id, referred_email,
        application_date, application_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?)`)
      .bind(crypto.randomUUID(), member?.id || "", application.referredByCode, id, application.email, now, now, now)
      .run();
  }

  await auditProfessional("application", id, "created", "public", "Professional application submitted.");
  await sendProfessionalEmail({
    to: application.email,
    subject: "Bingo Dog Walker Club application received",
    html: `<p>Thanks ${escapeHtml(application.fullName)}. Your Bingo Dog Walker Club application has been received and is pending review.</p>`,
  });

  return corsResponse(request, {
    ok: true,
    applicationId: id,
    status: "Pending",
    message: "Your application has been received and is pending review.",
  });
}

async function professionalApplicationStatus(request, url) {
  const id = cleanText(url.searchParams.get("id"), 80);
  const email = cleanEmail(url.searchParams.get("email"));
  if (!id || !email) {
    return corsResponse(request, { ok: false, error: "Application id and email are required." }, 400);
  }

  const application = await giftCardDb()
    .prepare("SELECT id, business_name, email, status, publication_status, created_at, submitted_at, reviewed_at, approved_at, updated_at FROM professional_applications WHERE id = ? AND email = ?")
    .bind(id, email)
    .first();

  if (!application) return corsResponse(request, { ok: false, error: "Application status was not found." }, 404);

  return corsResponse(request, {
    ok: true,
    application: {
      id: application.id,
      businessName: application.business_name,
      status: application.status,
      publicationStatus: application.publication_status || "Unpublished",
      submittedAt: application.submitted_at || application.created_at,
      reviewedAt: application.reviewed_at || "",
      approvedAt: application.approved_at || "",
      updatedAt: application.updated_at || ""
    }
  });
}

async function professionalDirectory(request, url) {
  const q = cleanText(url.searchParams.get("q"), 120).toLowerCase();
  const type = cleanText(url.searchParams.get("type"), 80);
  const area = cleanText(url.searchParams.get("area"), 80).toLowerCase();
  const service = cleanText(url.searchParams.get("service"), 80).toLowerCase();
  const insured = cleanText(url.searchParams.get("insured"), 10);
  const dbs = cleanText(url.searchParams.get("dbs"), 10);
  const founding = cleanText(url.searchParams.get("founding"), 10);
  const filters = ["p.publication_status = 'Published'", "m.status = 'Active'", "a.status = 'Approved'", "a.publication_status = 'Published'"];
  const values = [];

  if (type) {
    filters.push("p.professional_type = ?");
    values.push(type);
  }

  if (area) {
    filters.push("(LOWER(p.areas_covered) LIKE ? OR LOWER(p.general_location) LIKE ?)");
    values.push(`%${area}%`, `%${area}%`);
  }

  if (service) {
    filters.push("LOWER(p.services_offered) LIKE ?");
    values.push(`%${service}%`);
  }

  if (insured === "yes") filters.push("LOWER(p.insurance_status) LIKE '%insured%'");
  if (dbs === "yes") filters.push("LOWER(p.dbs_status) LIKE '%dbs%'");
  if (founding === "yes") filters.push("p.founding_member = 1");
  if (q) {
    filters.push("(LOWER(p.business_name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.areas_covered) LIKE ? OR LOWER(p.services_offered) LIKE ?)");
    values.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  const result = await giftCardDb()
    .prepare(`SELECT p.* FROM professional_profiles p
      JOIN professional_members m ON m.id = p.member_id
      JOIN professional_applications a ON a.id = m.application_id
      WHERE ${filters.join(" AND ")}
      ORDER BY p.founding_member DESC, p.published_at DESC, p.business_name ASC LIMIT 100`)
    .bind(...values)
    .all();

  return corsResponse(request, {
    ok: true,
    profiles: (result.results || []).map(publicProfessionalProfileShape),
  });
}

async function professionalProfile(request, url) {
  const slug = cleanSlug(url.searchParams.get("slug"));
  if (!slug) return corsResponse(request, { ok: false, error: "Profile slug is required." }, 400);

  const profile = await giftCardDb()
    .prepare(`SELECT p.* FROM professional_profiles p
      JOIN professional_members m ON m.id = p.member_id
      JOIN professional_applications a ON a.id = m.application_id
      WHERE p.slug = ? AND p.publication_status = 'Published' AND m.status = 'Active' AND a.status = 'Approved' AND a.publication_status = 'Published'`)
    .bind(slug)
    .first();

  if (!profile) return corsResponse(request, { ok: false, error: "Profile not found." }, 404);

  return corsResponse(request, { ok: true, profile: publicProfessionalProfileShape(profile, true) });
}

async function createProfessionalEnquiry(request) {
  const input = await readJson(request);
  if (!input) return corsResponse(request, { ok: false, error: "Invalid JSON request." }, 400);

  const slug = cleanSlug(input.slug);
  const customerName = cleanText(input.customerName, 120);
  const customerEmail = cleanEmail(input.customerEmail);
  const shareConsent = Boolean(input.shareConsent);

  if (!slug || !customerName || !customerEmail || !shareConsent) {
    return corsResponse(request, { ok: false, error: "Name, email, profile and consent are required." }, 400);
  }

  const profile = await giftCardDb()
    .prepare("SELECT id, member_id, business_name FROM professional_profiles WHERE slug = ? AND publication_status = 'Published'")
    .bind(slug)
    .first();

  if (!profile) return corsResponse(request, { ok: false, error: "Professional profile not found." }, 404);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await giftCardDb()
    .prepare(`INSERT INTO professional_enquiries (
      id, profile_id, member_id, customer_name, customer_email, customer_phone,
      postcode, dog_details, service_required, preferred_dates, message,
      share_consent, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'New', ?)`)
    .bind(
      id,
      profile.id,
      profile.member_id,
      customerName,
      customerEmail,
      cleanText(input.customerPhone, 60),
      cleanText(input.postcode, 20).toUpperCase(),
      cleanText(input.dogDetails, 500),
      cleanText(input.serviceRequired, 160),
      cleanText(input.preferredDates, 160),
      cleanText(input.message, 1000),
      now
    )
    .run();

  await auditProfessional("enquiry", id, "created", "public", `Customer enquiry for ${profile.business_name}.`);
  await sendProfessionalEmail({
    to: "info@bingodogwash.com",
    subject: `New professional enquiry for ${profile.business_name}`,
    html: `<p>A new customer enquiry has been submitted for ${escapeHtml(profile.business_name)}.</p><p>Customer: ${escapeHtml(customerName)} (${escapeHtml(customerEmail)})</p>`,
  });

  return corsResponse(request, { ok: true, enquiryId: id, message: "Your enquiry has been sent securely." });
}

async function adminProfessionalApplications(request, url) {
  const q = cleanText(url.searchParams.get("q"), 120).toLowerCase();
  const status = cleanText(url.searchParams.get("status"), 60);
  const filters = [];
  const values = [];

  if (q) {
    filters.push("(LOWER(full_name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(business_name) LIKE ? OR LOWER(business_postcode) LIKE ?)");
    values.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (status) {
    filters.push("status = ?");
    values.push(status);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const result = await giftCardDb()
    .prepare(`SELECT * FROM professional_applications ${where} ORDER BY created_at DESC LIMIT 150`)
    .bind(...values)
    .all();

  return corsResponse(request, { ok: true, applications: (result.results || []).map(adminApplicationShape) });
}

async function adminProfessionalStats(request) {
  const [applications, members, founding] = await Promise.all([
    giftCardDb().prepare("SELECT COUNT(*) AS count FROM professional_applications").first(),
    giftCardDb().prepare("SELECT COUNT(*) AS count FROM professional_members WHERE status = 'Active'").first(),
    giftCardDb().prepare("SELECT COUNT(*) AS count FROM professional_members WHERE founding_member = 1 AND status = 'Active'").first()
  ]);
  const foundingLimit = 100;
  const foundingCount = Number(founding?.count || 0);
  return corsResponse(request, {
    ok: true,
    totalApplications: Number(applications?.count || 0),
    approvedMembers: Number(members?.count || 0),
    foundingMembers: foundingCount,
    placesRemaining: Math.max(0, foundingLimit - foundingCount),
    foundingLimit
  });
}

async function adminProfessionalApplicationAction(request, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const id = cleanText(parts[4], 80);
  const action = cleanText(parts[5], 40);
  const input = (await readJson(request)) || {};
  const actor = adminActor(request);

  const application = await giftCardDb()
    .prepare("SELECT * FROM professional_applications WHERE id = ?")
    .bind(id)
    .first();

  if (!application) return corsResponse(request, { ok: false, error: "Application not found." }, 404);

  if (action === "approve") return approveProfessionalApplication(request, application, actor, input);
  if (action === "publish") return publishProfessionalApplication(request, application, actor, true);
  if (action === "unpublish") return publishProfessionalApplication(request, application, actor, false);

  const statusMap = {
    reject: "Rejected",
    "more-info": "More information required",
    review: "Under review",
    suspend: "Suspended",
  };
  const status = statusMap[action];
  if (!status) return corsResponse(request, { ok: false, error: "Unknown action." }, 400);

  const now = new Date().toISOString();
  await giftCardDb().batch([
    giftCardDb()
      .prepare("UPDATE professional_applications SET status = ?, publication_status = CASE WHEN ? IN ('Rejected', 'Suspended') THEN 'Unpublished' ELSE publication_status END, admin_notes = ?, reviewed_at = ?, reviewed_by = ?, updated_at = ? WHERE id = ?")
      .bind(status, status, cleanText(input.adminNotes, 1000), now, actor, now, application.id),
    giftCardDb()
      .prepare(`UPDATE professional_profiles SET publication_status = CASE WHEN ? IN ('Rejected', 'Suspended') THEN 'Unpublished' ELSE publication_status END, updated_at = ? WHERE member_id IN (SELECT id FROM professional_members WHERE application_id = ?)`)
      .bind(status, now, application.id),
    giftCardDb()
      .prepare(`UPDATE professional_members SET status = CASE WHEN ? = 'Suspended' THEN 'Suspended' ELSE status END, updated_at = ? WHERE application_id = ?`)
      .bind(status, now, application.id)
  ]);
  await auditProfessional("application", application.id, action, actor, `Application marked ${status}.`);

  return corsResponse(request, { ok: true, status });
}

async function approveProfessionalApplication(request, application, actor, input) {
  if (application.status === "Approved") {
    return corsResponse(request, { ok: false, error: "This application is already approved." }, 409);
  }
  const now = new Date().toISOString();
  const existingMember = await giftCardDb()
    .prepare("SELECT * FROM professional_members WHERE application_id = ?")
    .bind(application.id)
    .first();

  if (existingMember) {
    await giftCardDb().batch([
      giftCardDb().prepare("UPDATE professional_applications SET status = 'Approved', publication_status = 'Unpublished', admin_notes = ?, reviewed_at = ?, approved_at = COALESCE(approved_at, ?), reviewed_by = ?, updated_at = ? WHERE id = ?")
        .bind(cleanText(input.adminNotes, 1000), now, now, actor, now, application.id),
      giftCardDb().prepare("UPDATE professional_members SET status = 'Active', updated_at = ? WHERE id = ?")
        .bind(now, existingMember.id),
      giftCardDb().prepare("UPDATE professional_profiles SET publication_status = 'Unpublished', published_at = '', updated_at = ? WHERE member_id = ?")
        .bind(now, existingMember.id)
    ]);
    await auditProfessional("application", application.id, "approved", actor, "Application re-approved and existing member reactivated.");
    return corsResponse(request, { ok: true, status: "Approved", member: adminMemberShape({ ...existingMember, status: "Active" }) });
  }

  const memberId = crypto.randomUUID();
  const profileId = crypto.randomUUID();
  const referralCode = await uniqueProfessionalReferralCode(application.business_name);
  const slug = await uniqueProfessionalSlug(application.business_name);
  const foundingEligible = application.professional_type === "Dog walker";
  const publicStatus = "Unpublished";

  await giftCardDb().batch([
    giftCardDb().prepare("UPDATE professional_applications SET status = 'Approved', publication_status = 'Unpublished', admin_notes = ?, reviewed_at = ?, approved_at = ?, reviewed_by = ?, updated_at = ? WHERE id = ?")
      .bind(cleanText(input.adminNotes, 1000), now, now, actor, now, application.id),
    giftCardDb().prepare(`INSERT OR IGNORE INTO professional_members (
      id, application_id, email, business_name, professional_type, status,
      founding_member, referral_code, wash_credits, rewards_balance,
      lifetime_discount_percent, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'Active', 0, ?, 0, 0, 0, ?, ?)`)
      .bind(memberId, application.id, application.email, application.business_name, application.professional_type, referralCode, now, now),
    giftCardDb().prepare(`INSERT OR IGNORE INTO professional_profiles (
      id, member_id, slug, business_name, professional_name, professional_type, general_location,
      description, services_offered, areas_covered, years_experience, website, social_profile,
      insurance_status, dbs_status, availability, publication_status, founding_member,
      created_at, updated_at, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`)
      .bind(
        profileId,
        memberId,
        slug,
        application.business_name,
        application.full_name,
        application.professional_type,
        application.business_postcode,
        application.business_description,
        application.services_offered,
        application.areas_covered,
        application.years_experience,
        safeUrl(application.website),
        safeUrl(application.social_profile),
        application.insurance_status,
        application.dbs_status,
        "Contact for availability",
        publicStatus,
        now,
        now,
        ""
      ),
    giftCardDb().prepare(`INSERT INTO professional_rewards (
      id, member_id, reward_type, value, description, created_at, status, source, created_by
    ) VALUES (?, ?, 'Welcome credit', 1, 'Welcome wash credit for approved professional member.', ?, 'Active', 'System', ?)`)
      .bind(crypto.randomUUID(), memberId, now, actor),
  ]);

  if (foundingEligible) {
    await allocateFoundingSlot(memberId, actor);
  }

  await giftCardDb()
    .prepare("UPDATE professional_referrals SET application_status = 'Approved', approval_date = ?, updated_at = ? WHERE referred_application_id = ?")
    .bind(now, now, application.id)
    .run();

  await auditProfessional("application", application.id, "approved", actor, "Application approved and member profile created.");
  await sendProfessionalEmail({
    to: application.email,
    subject: "Bingo Dog Walker Club application approved",
    html: `<p>Congratulations ${escapeHtml(application.full_name)}. Your Bingo Dog Walker Club application has been approved.</p><p>Your referral code is <strong>${escapeHtml(referralCode)}</strong>.</p>`,
  });

  const member = await giftCardDb().prepare("SELECT * FROM professional_members WHERE id = ?").bind(memberId).first();
  return corsResponse(request, { ok: true, status: "Approved", member: adminMemberShape(member) });
}

async function publishProfessionalApplication(request, application, actor, publish) {
  if (application.status !== "Approved") {
    return corsResponse(request, { ok: false, error: "Only approved applications can be published." }, 400);
  }
  const now = new Date().toISOString();
  const publicationStatus = publish ? "Published" : "Unpublished";
  const profile = await giftCardDb()
    .prepare("SELECT p.id FROM professional_profiles p JOIN professional_members m ON m.id = p.member_id WHERE m.application_id = ?")
    .bind(application.id)
    .first();
  if (!profile) return corsResponse(request, { ok: false, error: "Approved profile was not found." }, 404);

  await giftCardDb().batch([
    giftCardDb().prepare("UPDATE professional_applications SET publication_status = ?, updated_at = ? WHERE id = ?")
      .bind(publicationStatus, now, application.id),
    giftCardDb().prepare("UPDATE professional_profiles SET publication_status = ?, published_at = ?, updated_at = ? WHERE id = ?")
      .bind(publicationStatus, publish ? now : "", now, profile.id)
  ]);
  await auditProfessional("application", application.id, publish ? "published" : "unpublished", actor, `Profile ${publicationStatus}.`);
  return corsResponse(request, { ok: true, status: application.status, publicationStatus });
}

async function adminProfessionalMembers(request, url) {
  const result = await giftCardDb()
    .prepare("SELECT * FROM professional_members ORDER BY created_at DESC LIMIT 150")
    .all();
  return corsResponse(request, { ok: true, members: (result.results || []).map(adminMemberShape) });
}

async function adminProfessionalEnquiries(request, url) {
  const result = await giftCardDb()
    .prepare(`SELECT e.*, p.business_name FROM professional_enquiries e
      LEFT JOIN professional_profiles p ON p.id = e.profile_id
      ORDER BY e.created_at DESC LIMIT 150`)
    .all();
  return corsResponse(request, { ok: true, enquiries: (result.results || []).map(adminEnquiryShape) });
}

async function adminProfessionalReward(request) {
  const input = (await readJson(request)) || {};
  const memberId = cleanText(input.memberId, 80);
  const value = Number.parseInt(input.value || "0", 10);
  if (!memberId || !Number.isFinite(value)) {
    return corsResponse(request, { ok: false, error: "Member and reward value are required." }, 400);
  }

  const now = new Date().toISOString();
  await giftCardDb()
    .prepare(`INSERT INTO professional_rewards (
      id, member_id, reward_type, value, description, created_at, expiry_date, status, source, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', 'Admin', ?)`)
    .bind(
      crypto.randomUUID(),
      memberId,
      cleanText(input.rewardType, 80) || "Manual adjustment",
      value,
      cleanText(input.description, 500),
      now,
      cleanText(input.expiryDate, 20),
      adminActor(request)
    )
    .run();
  await auditProfessional("member", memberId, "reward-adjustment", adminActor(request), `Reward adjustment ${value}.`);
  return corsResponse(request, { ok: true });
}

async function allocateFoundingSlot(memberId, actor) {
  for (let slot = 1; slot <= 100; slot += 1) {
    const now = new Date().toISOString();
    const result = await giftCardDb()
      .prepare("INSERT OR IGNORE INTO professional_founding_slots (slot, member_id, granted_at, granted_by) VALUES (?, ?, ?, ?)")
      .bind(slot, memberId, now, actor)
      .run();

    if (result?.meta?.changes) {
      await giftCardDb()
        .prepare("UPDATE professional_members SET founding_member = 1, founding_position = ?, founding_granted_at = ?, founding_granted_by = ?, lifetime_discount_percent = 10, wash_credits = wash_credits + 1, updated_at = ? WHERE id = ?")
        .bind(slot, now, actor, now, memberId)
        .run();
      await giftCardDb()
        .prepare("UPDATE professional_profiles SET founding_member = 1, updated_at = ? WHERE member_id = ?")
        .bind(now, memberId)
        .run();
      await auditProfessional("member", memberId, "founding-slot-granted", actor, `Founding slot ${slot} granted.`);
      return slot;
    }
  }
  return null;
}

function normalizeProfessionalApplication(input) {
  const servicesOffered = Array.isArray(input.servicesOffered)
    ? input.servicesOffered.map((item) => cleanText(item, 80)).filter(Boolean).join(", ")
    : cleanText(input.servicesOffered, 600);
  return {
    fullName: cleanText(input.fullName || input.full_name, 120),
    email: cleanEmail(input.email),
    phone: cleanText(input.phone, 60),
    businessName: cleanText(input.businessName || input.business_name, 160),
    businessPostcode: cleanText(input.businessPostcode || input.business_postcode || input.postcode, 20).toUpperCase(),
    professionalType: cleanText(input.professionalType || "Dog walker", 80),
    areasCovered: cleanText(input.areasCovered, 500),
    website: safeUrl(input.website),
    socialProfile: safeUrl(input.socialProfile),
    yearsExperience: cleanText(input.yearsExperience, 80),
    businessDescription: cleanText(input.businessDescription, 1000),
    servicesOffered: cleanText(servicesOffered, 600),
    insuranceStatus: cleanText(input.insuranceStatus, 120),
    dbsStatus: cleanText(input.dbsStatus, 120),
    privacyConsent: Boolean(input.privacyConsent),
    marketingConsent: Boolean(input.marketingConsent),
    privacyPolicyVersion: cleanText(input.privacyPolicyVersion || "2026-07-15", 40),
    referredByCode: cleanReferralCode(input.referredByCode || input.ref),
  };
}

function validateProfessionalApplication(application) {
  const errors = [];
  if (!application.fullName) errors.push({ field: "fullName", message: "Full name is required." });
  if (!application.email) errors.push({ field: "email", message: "Valid email is required." });
  if (!application.phone) errors.push({ field: "phone", message: "Phone number is required." });
  if (!application.businessName) errors.push({ field: "businessName", message: "Business name is required." });
  if (!application.businessPostcode) errors.push({ field: "businessPostcode", message: "Postcode is required." });
  if (!application.privacyConsent) errors.push({ field: "privacyConsent", message: "Privacy consent is required." });
  return errors;
}

function publicProfessionalProfileShape(profile, full = false) {
  const base = {
    slug: cleanSlug(profile.slug),
    businessName: publicText(profile.business_name, 160),
    professionalName: full ? publicText(profile.professional_name, 120) : "",
    professionalType: publicText(profile.professional_type, 80),
    generalLocation: publicText(profile.general_location, 120),
    description: publicText(profile.description, 1000),
    servicesOffered: splitList(profile.services_offered).map((item) => publicText(item, 80)),
    areasCovered: splitList(profile.areas_covered).map((item) => publicText(item, 80)),
    yearsExperience: publicText(profile.years_experience, 80),
    website: safeUrl(profile.website),
    socialProfile: safeUrl(profile.social_profile),
    insuranceStatus: publicText(profile.insurance_status, 120),
    dbsStatus: publicText(profile.dbs_status, 120),
    availability: publicText(profile.availability, 160),
    logoUrl: profile.logo_url || "",
    foundingMember: Boolean(profile.founding_member),
  };
  return base;
}

function adminApplicationShape(application) {
  return {
    id: application.id,
    fullName: application.full_name,
    email: application.email,
    phone: application.phone,
    businessName: application.business_name,
    businessPostcode: application.business_postcode,
    professionalType: application.professional_type,
    areasCovered: application.areas_covered || "",
    businessTownCity: application.business_town_city || "",
    businessDescription: application.business_description || "",
    yearsExperience: application.years_experience || "",
    website: application.website || "",
    socialProfile: application.social_profile || "",
    servicesOffered: application.services_offered || "",
    insuranceStatus: application.insurance_status || "",
    dbsStatus: application.dbs_status || "",
    status: application.status,
    publicationStatus: application.publication_status || "Unpublished",
    adminNotes: application.admin_notes || "",
    referredByCode: application.referred_by_code || "",
    privacyPolicyVersion: application.privacy_policy_version || "",
    createdAt: application.created_at,
    submittedAt: application.submitted_at || application.created_at,
    approvedAt: application.approved_at || "",
    reviewedAt: application.reviewed_at || "",
  };
}

function adminMemberShape(member) {
  if (!member) return null;
  return {
    id: member.id,
    email: member.email,
    businessName: member.business_name,
    professionalType: member.professional_type,
    status: member.status,
    foundingMember: Boolean(member.founding_member),
    foundingPosition: member.founding_position || "",
    referralCode: member.referral_code,
    washCredits: member.wash_credits,
    rewardsBalance: member.rewards_balance,
    lifetimeDiscountPercent: member.lifetime_discount_percent,
    createdAt: member.created_at,
  };
}

function adminEnquiryShape(enquiry) {
  return {
    id: enquiry.id,
    businessName: enquiry.business_name || "",
    customerName: enquiry.customer_name,
    customerEmail: enquiry.customer_email,
    customerPhone: enquiry.customer_phone || "",
    postcode: enquiry.postcode || "",
    serviceRequired: enquiry.service_required || "",
    status: enquiry.status,
    createdAt: enquiry.created_at,
  };
}

async function uniqueProfessionalReferralCode(seed) {
  const base = (cleanReferralCode(seed) || "BINGO").slice(0, 6);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = `${base}${Math.floor(100 + Math.random() * 900 + attempt)}`.slice(0, 12);
    const existing = await giftCardDb().prepare("SELECT id FROM professional_members WHERE referral_code = ?").bind(code).first();
    if (!existing) return code;
  }
  return `BINGO${Date.now().toString().slice(-6)}`;
}

async function uniqueProfessionalSlug(value) {
  const base = cleanSlug(value) || `professional-${Date.now()}`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt ? `${base}-${attempt + 1}` : base;
    const existing = await giftCardDb().prepare("SELECT id FROM professional_profiles WHERE slug = ?").bind(slug).first();
    if (!existing) return slug;
  }
  return `${base}-${Date.now()}`;
}

function cleanSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function cleanReferralCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

function safeUrl(value) {
  const text = cleanText(value, 300);
  if (!text) return "";
  try {
    const url = new URL(text.startsWith("http") ? text : `https://${text}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function splitList(value) {
  return String(value || "")
    .split(/[,;\n]/)
    .map((item) => cleanText(item, 80))
    .filter(Boolean)
    .slice(0, 12);
}

function publicText(value, maxLength = 500) {
  return cleanText(value, maxLength).replace(/[<>]/g, "");
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function handleAdminAiDrafts(request) {
  const origin = request.headers.get("Origin") || "";
  if (origin && !ADMIN_AI_DRAFTS_ORIGINS.has(origin)) {
    return aiDraftCorsResponse(request, { ok: false, error: "Origin is not allowed." }, 403);
  }
  if (!(await isAdminRequest(request))) {
    return aiDraftCorsResponse(request, { ok: false, error: "Admin authorisation required." }, 401);
  }
  if (request.method !== "POST") {
    return aiDraftCorsResponse(request, { ok: false, error: "Method not allowed." }, 405);
  }

  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 12000) {
    return aiDraftCorsResponse(request, { ok: false, error: "Draft request is too large." }, 413);
  }

  const input = await readJson(request);
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return aiDraftCorsResponse(request, { ok: false, error: "Enter valid product details." }, 400);
  }

  const product = {
    name: cleanText(input.name, 160),
    category: cleanText(input.category, 100),
    price: cleanText(input.price, 40),
    description: cleanMultilineText(input.description, 1800),
    audience: cleanText(input.audience, 240),
    url: safeUrl(input.url),
  };
  const tone = ["friendly", "professional", "playful"].includes(input.tone) ? input.tone : "friendly";
  if (!product.name || !product.description) {
    return aiDraftCorsResponse(request, { ok: false, error: "Product name and description are required." }, 400);
  }

  const ai = envValue("AI");
  if (!ai?.run) {
    return aiDraftCorsResponse(request, { ok: false, error: "AI drafting is not configured." }, 503);
  }

  try {
    const model = envText("MARKETING_AI_MODEL") || "@cf/meta/llama-3.1-8b-instruct-fp8-fast";
    const result = await ai.run(model, {
      messages: [
        {
          role: "system",
          content: "You draft UK English marketing copy for Bingo Dog Wash. Use only supplied facts. Never invent claims, discounts, reviews, availability, delivery promises, health benefits, or prices. Return only valid JSON with string fields productDescription, socialCaption, emailSubject, and emailPreview. Keep the product description under 500 characters, social caption under 700 characters, email subject under 70 characters, and email preview under 180 characters."
        },
        {
          role: "user",
          content: JSON.stringify({ product, tone })
        }
      ],
      max_tokens: 520,
      temperature: 0.6,
    });
    const raw = cleanMultilineText(result?.response || result?.result?.response, 5000)
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "");
    let generated;
    try {
      generated = JSON.parse(raw);
    } catch {
      return aiDraftCorsResponse(request, { ok: false, error: "AI returned an invalid draft. Please try again." }, 502);
    }
    const draft = {
      productDescription: cleanMultilineText(generated?.productDescription, 500),
      socialCaption: cleanMultilineText(generated?.socialCaption, 700),
      emailSubject: cleanText(generated?.emailSubject, 70),
      emailPreview: cleanMultilineText(generated?.emailPreview, 180),
    };
    if (!draft.productDescription || !draft.socialCaption) {
      return aiDraftCorsResponse(request, { ok: false, error: "AI returned an incomplete draft. Please try again." }, 502);
    }
    return aiDraftCorsResponse(request, {
      ok: true,
      draft,
      generatedAt: new Date().toISOString(),
      saved: false,
      publishable: false,
    });
  } catch (error) {
    logExternalError("Admin AI draft failed", { error });
    return aiDraftCorsResponse(request, { ok: false, error: "AI drafting is temporarily unavailable." }, 502);
  }
}

async function auditProfessional(entityType, entityId, eventType, actor, detail) {
  await giftCardDb()
    .prepare("INSERT INTO professional_audit_events (id, entity_type, entity_id, event_type, actor, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), entityType, entityId, eventType, cleanText(actor, 120), cleanText(detail, 500), new Date().toISOString())
    .run();
}

async function sendProfessionalEmail({ to, subject, html }) {
  if (!to) return;
  await sendResendEmail({ to, subject, html });
}

function giftCardDb() {
  return envValue("GIFT_CARD_DB") || null;
}

async function isAdminRequest(request) {
  const expected = envText("ADMIN_API_TOKEN");
  if (!expected) return false;
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("X-Admin-Token") || "";
  return timingSafeEqualBytes(token, expected);
}

function adminActor(request) {
  return cleanText(request.headers.get("X-Admin-Actor") || "admin", 120);
}

function cleanGiftCardCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 19);
}

function cleanDeliveryDate(value) {
  const text = cleanText(value, 20);
  if (!text) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function formatMoney(pence) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(pence || 0) / 100);
}

async function uniqueGiftCardCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = giftCardCode();
    const existing = await giftCardDb()
      .prepare("SELECT id FROM gift_cards WHERE code = ?")
      .bind(code)
      .first();
    if (!existing) return code;
  }

  throw new Error("Could not generate a unique gift card code.");
}

function giftCardCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const characters = [];
  while (characters.length < 12) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (characters.length >= 12) break;
      if (byte < 224) characters.push(alphabet[byte % alphabet.length]);
    }
  }
  const text = characters.join("");
  return `BDW-${text.slice(0, 4)}-${text.slice(4, 8)}-${text.slice(8, 12)}`;
}

function statusFromBalance(remaining, original) {
  if (remaining <= 0) return "Redeemed";
  if (remaining < original) return "Partially Used";
  return "Active";
}

function adminGiftCardShape(card) {
  return {
    code: card.code,
    originalAmount: card.original_amount,
    originalAmountDisplay: formatMoney(card.original_amount),
    remainingBalance: card.remaining_balance,
    remainingBalanceDisplay: formatMoney(card.remaining_balance),
    status: card.status,
    buyerName: card.buyer_name,
    buyerEmail: card.buyer_email,
    recipientName: card.recipient_name,
    recipientEmail: card.recipient_email,
    message: card.message || "",
    purchaseDate: card.purchase_date,
    deliveryDate: card.delivery_date || "",
    deliveredAt: card.delivered_at || "",
    stripeCheckoutSessionId: card.stripe_checkout_session_id,
    stripePaymentIntentId: card.stripe_payment_intent_id || "",
  };
}

function dbCardToEmailCard(card) {
  return {
    code: card.code,
    originalAmount: card.original_amount,
    buyerName: card.buyer_name,
    buyerEmail: card.buyer_email,
    recipientName: card.recipient_name,
    recipientEmail: card.recipient_email,
    message: card.message || "",
    deliveryDate: card.delivery_date || "",
  };
}

async function auditGiftCard(giftCardId, eventType, detail) {
  await giftCardDb()
    .prepare("INSERT INTO gift_card_events (id, event_type, gift_card_id, detail, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), eventType, giftCardId, cleanText(detail, 500), new Date().toISOString())
    .run();
}

async function sendGiftCardEmails(cards, options = {}) {
  const apiKey = envText("RESEND_API_KEY");
  if (!apiKey) return false;

  let allSent = true;

  for (const card of cards) {
    if (!options.force && card.deliveryDate && card.deliveryDate > new Date().toISOString().slice(0, 10)) {
      continue;
    }

    const recipientSent = await sendResendEmail({
      to: card.recipientEmail,
      subject: "Your Bingo Dog Wash digital gift card",
      html: giftCardRecipientEmail(card),
    });

    const buyerSent = await sendResendEmail({
      to: card.buyerEmail,
      subject: "Bingo Dog Wash gift card purchase confirmation",
      html: giftCardBuyerEmail(card),
    });

    allSent = Boolean(recipientSent && buyerSent) && allSent;
  }

  return allSent;
}

async function deliverDueGiftCards() {
  if (!giftCardDb()) return;

  const today = new Date().toISOString().slice(0, 10);
  const result = await giftCardDb()
    .prepare(`SELECT * FROM gift_cards
      WHERE delivery_date <> '' AND delivery_date <= ?
      AND COALESCE(delivered_at, '') = ''
      AND status NOT IN ('Cancelled', 'Expired')
      ORDER BY delivery_date ASC LIMIT 50`)
    .bind(today)
    .all();

  for (const row of result.results || []) {
    const sent = await sendGiftCardEmails([dbCardToEmailCard(row)], { force: true });
    if (!sent) continue;

    await markGiftCardDelivered(row.id, row.recipient_email, "Scheduled delivery email accepted by provider.");
  }
}

async function markGiftCardDelivered(giftCardId, recipientEmail, detail) {
  const deliveredAt = new Date().toISOString();
  await giftCardDb()
    .prepare("UPDATE gift_cards SET delivered_at = ?, updated_at = ? WHERE id = ?")
    .bind(deliveredAt, deliveredAt, giftCardId)
    .run();
  await auditGiftCard(giftCardId, "delivered", `${detail} Recipient: ${recipientEmail}.`);
}

async function sendResendEmail({ from, to, subject, html, text, replyTo, errorLabel = "Resend email failed" }) {
  const apiKey = envText("RESEND_API_KEY");
  if (!apiKey || !to) return;

  const body = {
    from: from || "Bingo Dog Wash <info@bingodogwash.com>",
    to,
    subject,
    html,
  };

  if (text) body.text = text;
  if (replyTo) body.reply_to = replyTo;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    logExternalError(errorLabel, {
      status: response.status,
      reason: cleanText(await response.text(), 300)
    });
    return false;
  }

  return true;
}

function giftCardRecipientEmail(card) {
  return `
    <div style="font-family:Arial,sans-serif;color:#102033">
      <h1>Bingo Dog Wash Gift Card</h1>
      <p>${escapeHtml(card.buyerName)} has sent you a ${formatMoney(card.originalAmount)} digital gift card.</p>
      <p style="font-size:24px;font-weight:bold">Code: ${escapeHtml(card.code)}</p>
      ${card.message ? `<p>${escapeHtml(card.message)}</p>` : ""}
      <p>Use it for eligible Bingo Dog Wash services and products.</p>
      <p>Keep this code private. Balance checks also require your recipient email address, and redeemed value cannot be spent again.</p>
      <p>Check your balance at https://bingodogwash.com/gift-cards.html.</p>
      <p>Visit https://bingodogwash.com or contact info@bingodogwash.com.</p>
    </div>
  `;
}

function giftCardBuyerEmail(card) {
  return `
    <div style="font-family:Arial,sans-serif;color:#102033">
      <h1>Gift card purchase confirmation</h1>
      <p>Your ${formatMoney(card.originalAmount)} Bingo Dog Wash gift card for ${escapeHtml(card.recipientName)} has been created.</p>
      <p>Gift card code: ${escapeHtml(card.code)}</p>
      <p>Contact info@bingodogwash.com if you need help.</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function verifyStripeSignature(
  payload,
  header,
  secret,
  toleranceSeconds = STRIPE_WEBHOOK_TOLERANCE_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  const { timestamp, signatures } = parseStripeSignatureHeader(header);

  if (!timestamp || signatures.length === 0) return false;
  if (!Number.isFinite(toleranceSeconds) || toleranceSeconds <= 0) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

  return signatures.some((signature) => timingSafeEqual(expected, signature));
}

function parseStripeSignatureHeader(header) {
  const parts = String(header || "").split(",");
  const signatures = [];
  let timestamp = 0;

  for (const part of parts) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    if (key === "t") {
      timestamp = Number.parseInt(value, 10);
    } else if (key === "v1" && value) {
      signatures.push(value);
    }
  }

  return {
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    signatures,
  };
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

async function timingSafeEqualBytes(left, right) {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(String(left || ""));
  const rightBytes = encoder.encode(String(right || ""));
  if (leftBytes.length !== rightBytes.length) return false;
  const leftDigest = await crypto.subtle.digest("SHA-256", leftBytes);
  const rightDigest = await crypto.subtle.digest("SHA-256", rightBytes);
  return timingSafeEqual(hex(leftDigest), hex(rightDigest));
}

function hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function cleanText(value, maxLength = 500) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanMultilineText(value, maxLength = 4000) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanEmail(value) {
  const email = String(value || "")
    .trim()
    .toLowerCase();

  const valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  return valid ? email.slice(0, 254) : "";
}

function cleanReference(value) {
  const reference = String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 200);

  return reference || `BDW-${Date.now()}`;
}

function corsResponse(request, body, status = 200) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://bingodogwash.com";

  const headers = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Admin-Actor, X-Admin-Token",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };

  if (body === null) {
    return new Response(null, {
      status,
      headers,
    });
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function aiDraftCorsResponse(request, body, status = 200) {
  const origin = request.headers.get("Origin") || "";
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, X-Admin-Token",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };

  if (ADMIN_AI_DRAFTS_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  if (body === null) return new Response(null, { status, headers });
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

export {
  corsResponse,
  flagValue,
  giftCardCode,
  normalizeGiveawayInput,
  normalizeEtsyImport,
  timingSafeEqual,
  timingSafeEqualBytes,
  verifyStripeSignature,
  withSecurityHeaders,
};
