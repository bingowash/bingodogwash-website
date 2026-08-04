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
  const allowed =
    origin.includes("bingodogwash.com") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1");

  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://bingodogwash.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function jsonResponse(request, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request)
    }
  });
}

function cleanText(value, fallback = "") {
  return String(value || fallback).replace(/\s+/g, " ").trim().slice(0, 500);
}

function cents(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.round(number * 100);
}

function productKeys(product) {
  const id = String(product.id || "");
  return [
    id,
    id.startsWith("avasam-") ? id.slice("avasam-".length) : `avasam-${id}`
  ];
}

async function fetchFeed(request, path) {
  try {
    const response = await fetch(new URL(path, request.url), { cf: { cacheTtl: 0 } });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : data.products || data.items || [];
  } catch (error) {
    return [];
  }
}

async function productMap(request) {
  const feedProducts = [
    ...FALLBACK_PRODUCTS,
    ...(await fetchFeed(request, "/api/avasam-products.json"))
  ];
  const map = new Map();

  for (const product of feedProducts) {
    for (const key of productKeys(product)) {
      if (key && !map.has(key)) map.set(key, product);
    }
  }

  return map;
}

function orderSummary(rows) {
  return rows.map(({ product, quantity, unitAmount }) => {
    const total = ((unitAmount * quantity) / 100).toFixed(2);
    return `${quantity} x ${product.name} | ${product.supplier || "Bingo Dog Wash"} | £${(unitAmount / 100).toFixed(2)} | Line total: £${total}`;
  }).join("\n");
}

async function sendOrderCopy(input, rows, total) {
  const form = new URLSearchParams();
  form.set("_subject", "New Bingo Dog Wash paid order started");
  form.set("_template", "table");
  form.set("_captcha", "false");
  form.set("name", cleanText(input.name));
  form.set("email", cleanText(input.email));
  form.set("telephone", cleanText(input.telephone));
  form.set("delivery_address", cleanText(input.delivery_address, "Not supplied"));
  form.set("message", cleanText(input.message));
  form.set("direct_total", `£${(total / 100).toFixed(2)}`);
  form.set("order_summary", orderSummary(rows));

  try {
    const response = await fetch("https://formsubmit.co/info@bingodogwash.com", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, status: 0 };
  }
}

function stripeParams(request, input, rows, total) {
  const origin = new URL(request.url).origin;
  const successUrl = new URL("/shop.html", origin);
  successUrl.searchParams.set("payment", "success");
  const cancelUrl = new URL("/cart.html", origin);
  cancelUrl.searchParams.set("payment", "cancelled");

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", successUrl.toString());
  params.set("cancel_url", cancelUrl.toString());
  params.set("phone_number_collection[enabled]", "true");
  params.append("shipping_address_collection[allowed_countries][]", "GB");
  params.set("metadata[order_source]", "Bingo Dog Wash cart");
  params.set("metadata[order_total]", `£${(total / 100).toFixed(2)}`);
  params.set("metadata[customer_name]", cleanText(input.name).slice(0, 120));
  params.set("metadata[telephone]", cleanText(input.telephone).slice(0, 120));
  params.set("metadata[order_summary]", orderSummary(rows).slice(0, 450));
  if (input.email) params.set("customer_email", cleanText(input.email).toLowerCase());

  rows.forEach(({ product, quantity, unitAmount }, index) => {
    params.set(`line_items[${index}][quantity]`, String(quantity));
    params.set(`line_items[${index}][price_data][currency]`, "gbp");
    params.set(`line_items[${index}][price_data][unit_amount]`, String(unitAmount));
    params.set(`line_items[${index}][price_data][product_data][name]`, cleanText(product.name, "Bingo Dog Wash product").slice(0, 120));
    if (product.description) {
      params.set(`line_items[${index}][price_data][product_data][description]`, cleanText(product.description).slice(0, 300));
    }
    if (product.image && String(product.image).startsWith("https://")) {
      params.append(`line_items[${index}][price_data][product_data][images][]`, product.image);
    }
  });

  return params;
}

function legacyOrderSummary(rows) {
  return rows.map(({ product, quantity, unitAmount }) => {
    const unit = `£${(unitAmount / 100).toFixed(2)}`;
    const total = `£${((unitAmount * quantity) / 100).toFixed(2)}`;
    return `${quantity} x ${product.name} | ${product.supplier || "Bingo Dog Wash"} | ${unit} | Line total: ${total}`;
  }).join("\n");
}

export async function onRequestOptions({ request }) {
  return jsonResponse(request, { ok: true });
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse(request, {
      ok: false,
      error: "Stripe secret key is not configured yet. Add STRIPE_SECRET_KEY to the hosted site environment."
    }, 503);
  }

  let input;
  try {
    input = await request.json();
  } catch (error) {
    return jsonResponse(request, { ok: false, error: "Invalid checkout request." }, 400);
  }

  const items = Array.isArray(input.items) ? input.items : [];
  if (!items.length) {
    return jsonResponse(request, { ok: false, error: "Your basket is empty." }, 400);
  }

  const map = await productMap(request);
  const counts = items.reduce((acc, item) => {
    const id = String(item.id || "");
    const quantity = Math.min(Math.max(Number(item.quantity || 1), 1), 20);
    acc[id] = (acc[id] || 0) + quantity;
    return acc;
  }, {});

  const rows = Object.entries(counts).map(([id, quantity]) => {
    const product = map.get(id);
    if (!product) return null;
    const unitAmount = cents(product.price);
    if (!unitAmount) return null;
    return { product, quantity, unitAmount };
  }).filter(Boolean).slice(0, 20);

  if (!rows.length) {
    return jsonResponse(request, { ok: false, error: "No payable products were found in the basket." }, 400);
  }

  const total = rows.reduce((sum, row) => sum + row.unitAmount * row.quantity, 0);
  const params = stripeParams(request, input, rows, total);
  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  const stripeData = await stripeResponse.json();

  if (!stripeResponse.ok || !stripeData.url) {
    return jsonResponse(request, {
      ok: false,
      error: stripeData.error?.message || "Stripe checkout could not be created."
    }, 502);
  }

  const orderEmail = await sendOrderCopy(input, rows, total);

  return jsonResponse(request, {
    ok: true,
    paymentUrl: stripeData.url,
    total: total / 100,
    orderEmail
  });
}
