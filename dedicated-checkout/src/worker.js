const PUBLIC_SITE_ORIGIN = "https://bingodogwash.com";
const CATALOGUE_TIMEOUT_MS = 5000;
const MAX_QUANTITY = 20;

const FALLBACK_PRODUCTS = [
  { id: "self-service-dog-wash", name: "Self-Service Dog Wash", price: 10, supplier: "Bingo Dog Wash" },
  { id: "coat-conditioner", name: "Silky Coat Conditioner", price: 13.5, supplier: "Dropship partner" },
  { id: "paw-balm", name: "Weatherproof Paw Balm", price: 9.95, supplier: "Future Bingo branded" },
  { id: "ear-cleaner", name: "Fresh Ear Cleaner", price: 8.99, supplier: "Affiliate supplier" },
  { id: "dental-kit", name: "Dog Dental Care Kit", price: 16.99, supplier: "Dropship partner" },
  { id: "slicker-brush", name: "Premium Grooming Brush", price: 14.99, supplier: "Future Bingo branded" },
  { id: "micro-towel", name: "Fast-Dry Microfibre Towel", price: 18, supplier: "Dropship partner" },
  { id: "cologne-spray", name: "Clean Coat Cologne Spray", price: 10.99, supplier: "Affiliate supplier" },
  { id: "joint-care", name: "Senior Joint Support", price: 24.99, supplier: "Dropship partner" }
];

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = origin.includes("bingodogwash.com") || origin.includes("localhost") || origin.includes("127.0.0.1");
  return { "Access-Control-Allow-Origin": allowed ? origin : "https://bingodogwash.com", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400" };
}
function json(request, data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...corsHeaders(request) } }); }
function cleanText(value, fallback = "") { return String(value || fallback).replace(/\s+/g, " ").trim().slice(0, 500); }
function cents(value) { const n = Number(value); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0; }
function available(product) { return Number.isFinite(Number(product?.price)) && !/out of stock|unavailable/i.test(String(product?.status || "")); }

export function productKeys(product) {
  const id = String(product?.id || "").trim();
  const sku = String(product?.sku || "").trim();
  const keys = new Set();
  if (id) {
    keys.add(id);
    if (id.startsWith("avasam-")) keys.add(id.slice("avasam-".length));
    if (id.startsWith("appscenic-")) keys.add(id.slice("appscenic-".length));
  }
  if (sku) {
    keys.add(sku);
    if (String(product?.supplier || "").toLowerCase().includes("avasam")) keys.add(`avasam-${sku}`);
  }
  return [...keys].filter(Boolean);
}

function isAvasamId(id) { return String(id).startsWith("avasam-"); }
async function fetchCatalogue(fetchImpl, path, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(new URL(path, PUBLIC_SITE_ORIGIN), { cf: { cacheTtl: 0 }, signal: controller.signal });
    if (!response.ok) return { ok: false, products: [] };
    const data = await response.json();
    return { ok: true, products: Array.isArray(data) ? data : data.products || data.items || [] };
  } catch (_) { return { ok: false, products: [] }; } finally { clearTimeout(timer); }
}
async function productMap(fetchImpl, timeoutMs) {
  const [appscenic, avasam] = await Promise.all([
    fetchCatalogue(fetchImpl, "/feeds/appscenic-products.json", timeoutMs),
    fetchCatalogue(fetchImpl, "/api/avasam/products?limit=100", timeoutMs)
  ]);
  const map = new Map();
  for (const product of [...FALLBACK_PRODUCTS, ...appscenic.products, ...avasam.products]) for (const key of productKeys(product)) if (!map.has(key)) map.set(key, product);
  return { map, avasamAvailable: avasam.ok };
}
function orderSummary(rows) { return rows.map(({ product, quantity, unitAmount }) => `${quantity} x ${product.name} | ${product.supplier || "Bingo Dog Wash"} | £${(unitAmount / 100).toFixed(2)} | Line total: £${((unitAmount * quantity) / 100).toFixed(2)}`).join("\n"); }
function stripeParams(input, rows, total) {
  const params = new URLSearchParams();
  params.set("mode", "payment"); params.set("success_url", "https://bingodogwash.com/shop.html?payment=success"); params.set("cancel_url", "https://bingodogwash.com/cart.html?payment=cancelled");
  params.set("phone_number_collection[enabled]", "true"); params.append("shipping_address_collection[allowed_countries][]", "GB");
  params.set("metadata[order_source]", "Bingo Dog Wash cart"); params.set("metadata[order_total]", `£${(total / 100).toFixed(2)}`); params.set("metadata[customer_name]", cleanText(input.name).slice(0, 120)); params.set("metadata[telephone]", cleanText(input.telephone).slice(0, 120)); params.set("metadata[order_summary]", orderSummary(rows).slice(0, 450));
  if (input.email) params.set("customer_email", cleanText(input.email).toLowerCase());
  rows.forEach(({ product, quantity, unitAmount }, i) => { params.set(`line_items[${i}][quantity]`, String(quantity)); params.set(`line_items[${i}][price_data][currency]`, "gbp"); params.set(`line_items[${i}][price_data][unit_amount]`, String(unitAmount)); params.set(`line_items[${i}][price_data][product_data][name]`, cleanText(product.name, "Bingo Dog Wash product").slice(0, 120)); if (product.description) params.set(`line_items[${i}][price_data][product_data][description]`, cleanText(product.description).slice(0, 300)); if (product.image && String(product.image).startsWith("https://")) params.append(`line_items[${i}][price_data][product_data][images][]`, product.image); });
  return params;
}
async function sendOrderCopy(fetchImpl, input, rows, total) {
  const form = new URLSearchParams({ _subject: "New Bingo Dog Wash paid order started", _template: "table", _captcha: "false", name: cleanText(input.name), email: cleanText(input.email), telephone: cleanText(input.telephone), delivery_address: cleanText(input.delivery_address, "Not supplied"), message: cleanText(input.message), direct_total: `£${(total / 100).toFixed(2)}`, order_summary: orderSummary(rows) });
  try { const response = await fetchImpl("https://formsubmit.co/info@bingodogwash.com", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() }); return { ok: response.ok, status: response.status }; } catch (_) { return { ok: false, status: 0 }; }
}
function groupedItems(items) {
  const counts = new Map();
  for (const item of items) { const id = String(item?.id || "").trim(); const q = item?.quantity; if (!id || typeof q !== "number" || !Number.isInteger(q) || q < 1 || q > MAX_QUANTITY) return null; const total = (counts.get(id) || 0) + q; if (total > MAX_QUANTITY) return null; counts.set(id, total); }
  return counts;
}

export function createWorker({ fetchImpl = fetch, timeoutMs = CATALOGUE_TIMEOUT_MS } = {}) {
  return { async fetch(request, env) {
    if (request.method === "OPTIONS") return json(request, { ok: true });
    if (request.method !== "POST") return json(request, { ok: false, error: "Use POST for checkout." }, 405);
    if (!env?.STRIPE_SECRET_KEY) return json(request, { ok: false, error: "Stripe secret key is not configured yet. Add STRIPE_SECRET_KEY to the hosted site environment." }, 503);
    let input; try { input = await request.json(); } catch (_) { return json(request, { ok: false, error: "Invalid checkout request." }, 400); }
    const items = Array.isArray(input.items) ? input.items : []; if (!items.length) return json(request, { ok: false, error: "Your basket is empty." }, 400);
    const counts = groupedItems(items); if (!counts) return json(request, { ok: false, error: "Basket quantities must be whole numbers from 1 to 20." }, 400);
    const { map, avasamAvailable } = await productMap(fetchImpl, timeoutMs);
    const rows = [];
    for (const [id, quantity] of counts) { const product = map.get(id); if (!product) return json(request, { ok: false, error: (!avasamAvailable || isAvasamId(id)) ? "The Avasam catalogue is temporarily unavailable. Please try again." : "A basket product could not be verified." }, (!avasamAvailable || isAvasamId(id)) ? 503 : 400); if (!available(product) || !cents(product.price)) return json(request, { ok: false, error: "A basket product is unavailable or has no valid server price." }, 400); rows.push({ product, quantity, unitAmount: cents(product.price) }); }
    const total = rows.reduce((sum, row) => sum + row.unitAmount * row.quantity, 0);
    const stripeResponse = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" }, body: stripeParams(input, rows, total).toString() });
    const stripeData = await stripeResponse.json(); if (!stripeResponse.ok || !stripeData.url) {
      console.error(JSON.stringify({
        event: "stripe_checkout_failed",
        stripeHttpStatus: stripeResponse.status,
        stripeRequestId: stripeResponse.headers.get("request-id") || "",
        stripeErrorType: cleanText(stripeData?.error?.type || ""),
        stripeErrorCode: cleanText(stripeData?.error?.code || ""),
        stripeErrorParam: cleanText(stripeData?.error?.param || ""),
        stripeErrorMessage: cleanText(stripeData?.error?.message || "")
      }));
      return json(request, { ok: false, error: stripeData.error?.message || "Stripe checkout could not be created." }, 502);
    }
    const orderEmail = await sendOrderCopy(fetchImpl, input, rows, total); return json(request, { ok: true, paymentUrl: stripeData.url, total: total / 100, orderEmail });
  } };
}
export default createWorker();
