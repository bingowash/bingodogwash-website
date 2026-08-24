import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/worker.js";

const avasam = { id: "avasam-S0671070991", sku: "S0671070991", name: "Fabric Pet Dog Cat Puppy Playpen", price: 42, supplier: "Avasam", status: "Available" };
const appscenic = { id: "appscenic-1", sku: "ASC-1", name: "AppScenic item", price: 12, supplier: "AppScenic" };
function responder({ avasamProducts = [avasam], avasamStatus = 200, appscenicProducts = [appscenic], timeout = false, stripeStatus = 200, stripeData = { url: "https://checkout.stripe.test/session" }, stripeRequestId = "" } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); if (timeout && String(url).includes("/api/avasam/")) return new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))); if (String(url).includes("/api/avasam/")) return new Response(JSON.stringify({ products: avasamProducts }), { status: avasamStatus }); if (String(url).includes("appscenic")) return new Response(JSON.stringify({ products: appscenicProducts })); if (String(url).includes("stripe")) return new Response(JSON.stringify(stripeData), { status: stripeStatus, headers: { "request-id": stripeRequestId } }); if (String(url).includes("formsubmit")) return new Response("ok"); throw new Error(`unexpected ${url}`); };
  return { calls, fetch };
}
async function checkout(mock, items, extras = {}, env = { STRIPE_SECRET_KEY: "test" }, workerOptions = {}) { const avasamCache = workerOptions.avasamCache || { value: null }; const w = (await import("../src/worker.js")).createWorker({ fetchImpl: mock.fetch, timeoutMs: 5, ...workerOptions, avasamCache }); return w.fetch(new Request("https://bingo-checkout.bingowash.workers.dev/", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://bingodogwash.com" }, body: JSON.stringify({ items, ...extras }) }), env); }
function stripe(mock) { return mock.calls.find((x) => x.url.includes("stripe")); }
test("prefixed and raw Avasam IDs resolve to the authoritative £42 product", async () => { for (const id of ["avasam-S0671070991", "S0671070991"]) { const m = responder(); const r = await checkout(m, [{ id, quantity: 1 }]); assert.equal(r.status, 200); assert.match(stripe(m).init.body, /unit_amount%5D=4200/); } });
test("browser low and high price tampering cannot change Stripe price", async () => { for (const price of [0.01, 9999]) { const m = responder(); await checkout(m, [{ id: avasam.id, quantity: 1, price }]); assert.match(stripe(m).init.body, /unit_amount%5D=4200/); } });
test("unknown Avasam products, unavailable products, and invalid server prices fail before Stripe", async () => { for (const products of [[], [{ ...avasam, status: "Out of stock" }], [{ ...avasam, price: "" }]]) { const m = responder({ avasamProducts: products }); const r = await checkout(m, [{ id: avasam.id, quantity: 1 }]); assert.ok(r.status >= 400); assert.equal(stripe(m), undefined); } });
test("empty and invalid or aggregated excessive quantities fail before Stripe", async () => { const cases = [[], [{ id: avasam.id, quantity: 0 }], [{ id: avasam.id, quantity: -1 }], [{ id: avasam.id, quantity: 1.5 }], [{ id: avasam.id, quantity: "NaN" }], [{ id: avasam.id, quantity: Infinity }], [{ id: avasam.id, quantity: 21 }], [{ id: avasam.id, quantity: 11 }, { id: avasam.id, quantity: 10 }]]; for (const items of cases) { const m = responder(); const r = await checkout(m, items); assert.equal(r.status, 400); assert.equal(stripe(m), undefined); } });
test("Avasam HTTP errors and timeouts return controlled temporary failures before Stripe", async () => { for (const options of [{ avasamStatus: 500 }, { timeout: true }]) { const m = responder(options); const r = await checkout(m, [{ id: avasam.id, quantity: 1 }]); assert.equal(r.status, 503); assert.match((await r.json()).error, /temporarily unavailable/); assert.equal(stripe(m), undefined); } });
test("valid multiple items preserve Stripe, URLs, shipping, metadata and order email behavior", async () => { const m = responder({ avasamProducts: [avasam, { ...avasam, id: "avasam-S2", sku: "S2", price: 10, name: "Second" }] }); const r = await checkout(m, [{ id: avasam.id, quantity: 1 }, { id: "S2", quantity: 2 }], { name: "N", email: "n@example.test", telephone: "1" }); assert.equal(r.status, 200); const body = stripe(m).init.body; for (const value of ["currency%5D=gbp", "unit_amount%5D=4200", "Fabric+Pet+Dog+Cat+Puppy+Playpen", "success_url=https%3A%2F%2Fbingodogwash.com%2Fshop.html%3Fpayment%3Dsuccess", "cancel_url=https%3A%2F%2Fbingodogwash.com%2Fcart.html%3Fpayment%3Dcancelled", "allowed_countries%5D%5B%5D=GB", "metadata%5Border_source%5D=Bingo+Dog+Wash+cart"]) assert.ok(body.includes(value)); assert.ok(m.calls.some((x) => x.url.includes("formsubmit"))); });
test("AppScenic and retained fallback products use server prices", async () => { for (const item of [{ id: "appscenic-1", quantity: 1, price: 1 }, { id: "paw-balm", quantity: 1, price: 9999 }]) { const m = responder(); const r = await checkout(m, [item]); assert.equal(r.status, 200); assert.ok(stripe(m)); } });
test("CORS, method rejection, and absent Stripe secret preserve contract and avoid catalogue work", async () => { const get = await worker.fetch(new Request("https://x/", { headers: { Origin: "https://localhost:8787" } }), {}); assert.equal(get.status, 405); assert.equal(get.headers.get("Access-Control-Allow-Origin"), "https://localhost:8787"); const m = responder(); const absent = await checkout(m, [{ id: avasam.id, quantity: 1 }], {}, {}); assert.equal(absent.status, 503); assert.equal(m.calls.length, 0); });
test("Stripe failure diagnostics are structured and exclude secrets and customer data", async () => { const m = responder({ stripeStatus: 400, stripeRequestId: "req_safe", stripeData: { error: { type: "invalid_request_error", code: "parameter_invalid_integer", param: "line_items[0][price_data][unit_amount]", message: "Safe Stripe error" } } }); const logs = []; const original = console.error; console.error = (value) => logs.push(String(value)); try { const r = await checkout(m, [{ id: avasam.id, quantity: 1 }], { email: "customer@example.test", telephone: "07123456789", delivery_address: "1 Private Road" }, { STRIPE_SECRET_KEY: "super-secret" }); assert.equal(r.status, 502); assert.equal((await r.json()).error, "Safe Stripe error"); } finally { console.error = original; } assert.equal(logs.length, 1); const event = JSON.parse(logs[0]); assert.deepEqual(event, { event: "stripe_checkout_failed", stripeHttpStatus: 400, stripeRequestId: "req_safe", stripeErrorType: "invalid_request_error", stripeErrorCode: "parameter_invalid_integer", stripeErrorParam: "line_items[0][price_data][unit_amount]", stripeErrorMessage: "Safe Stripe error" }); for (const forbidden of ["super-secret", "Authorization", "customer@example.test", "07123456789", "1 Private Road"]) assert.equal(logs[0].includes(forbidden), false); });
test("successful Stripe checkout emits no Stripe failure diagnostic", async () => { const m = responder(); const logs = []; const original = console.error; console.error = (value) => logs.push(String(value)); try { const r = await checkout(m, [{ id: avasam.id, quantity: 1 }]); assert.equal(r.status, 200); } finally { console.error = original; } assert.equal(logs.some((value) => value.includes("stripe_checkout_failed")), false); });

test("fresh successful Avasam cache avoids a second live fetch and keeps the server price", async () => {
  const cache = { value: null }; let now = 1_000_000;
  const first = responder(); await checkout(first, [{ id: avasam.id, quantity: 1, price: 0.01 }], {}, undefined, { avasamCache: cache, now: () => now });
  const second = responder({ timeout: true }); const response = await checkout(second, [{ id: avasam.id, quantity: 1, price: 9999 }], {}, undefined, { avasamCache: cache, now: () => now + 1_000 });
  assert.equal(response.status, 200); assert.equal(second.calls.some((call) => call.url.includes("/api/avasam/")), false); assert.match(stripe(second).init.body, /unit_amount%5D=4200/);
});

test("a successful live refresh replaces the last-known-good catalogue", async () => {
  const cache = { value: null }; let now = 2_000_000;
  const first = responder(); await checkout(first, [{ id: avasam.id, quantity: 1 }], {}, undefined, { avasamCache: cache, now: () => now });
  now += 61_000; const refreshed = { ...avasam, price: 43 }; const second = responder({ avasamProducts: [refreshed] }); await checkout(second, [{ id: avasam.id, quantity: 1 }], {}, undefined, { avasamCache: cache, now: () => now });
  const third = responder({ timeout: true }); const response = await checkout(third, [{ id: avasam.id, quantity: 1, price: 0.01 }], {}, undefined, { avasamCache: cache, now: () => now + 61_000 });
  assert.equal(response.status, 200); assert.match(stripe(third).init.body, /unit_amount%5D=4300/);
});

for (const failure of [{ timeout: true }, { avasamStatus: 500 }]) {
  test(`recent last-known-good cache permits checkout after Avasam ${failure.timeout ? "timeout" : "5xx"}`, async () => {
    const cache = { value: null }; let now = 3_000_000;
    const first = responder(); await checkout(first, [{ id: avasam.id, quantity: 1 }], {}, undefined, { avasamCache: cache, now: () => now });
    now += 61_000; const failed = responder(failure); const response = await checkout(failed, [{ id: avasam.id, quantity: 1 }], {}, undefined, { avasamCache: cache, now: () => now });
    assert.equal(response.status, 200); assert.ok(failed.calls.some((call) => call.url.includes("/api/avasam/"))); assert.ok(stripe(failed));
  });
}

test("stale or absent Avasam cache fails closed before Stripe", async () => {
  const cache = { value: null }; let now = 4_000_000;
  const first = responder(); await checkout(first, [{ id: avasam.id, quantity: 1 }], {}, undefined, { avasamCache: cache, now: () => now });
  now += 300_001; const stale = responder({ avasamStatus: 500 }); const staleResponse = await checkout(stale, [{ id: avasam.id, quantity: 1 }], {}, undefined, { avasamCache: cache, now: () => now });
  assert.equal(staleResponse.status, 503); assert.equal(stripe(stale), undefined);
  const absent = responder({ avasamStatus: 500 }); const absentResponse = await checkout(absent, [{ id: avasam.id, quantity: 1 }], {}, undefined, { avasamCache: { value: null }, now: () => now });
  assert.equal(absentResponse.status, 503); assert.equal(stripe(absent), undefined);
});

test("cached unavailable and unknown Avasam products remain fail-closed", async () => {
  const unavailableCache = { value: null }; let now = 5_000_000; const unavailable = responder({ avasamProducts: [{ ...avasam, status: "Unavailable" }] }); await checkout(unavailable, [{ id: avasam.id, quantity: 1 }], {}, undefined, { avasamCache: unavailableCache, now: () => now });
  now += 61_000; const unavailableFallback = responder({ timeout: true }); const unavailableResponse = await checkout(unavailableFallback, [{ id: avasam.id, quantity: 1 }], {}, undefined, { avasamCache: unavailableCache, now: () => now });
  assert.equal(unavailableResponse.status, 400); assert.equal(stripe(unavailableFallback), undefined);
  const knownCache = { value: null }; const known = responder(); await checkout(known, [{ id: avasam.id, quantity: 1 }], {}, undefined, { avasamCache: knownCache, now: () => now });
  now += 61_000; const unknownFallback = responder({ timeout: true }); const unknownResponse = await checkout(unknownFallback, [{ id: "avasam-unknown", quantity: 1 }], {}, undefined, { avasamCache: knownCache, now: () => now });
  assert.equal(unknownResponse.status, 503); assert.equal(stripe(unknownFallback), undefined);
});

test("cache retains only normalized supplier fields and never checkout customer input", async () => {
  const cache = { value: null }; const supplierProduct = { ...avasam, privateCustomerEmail: "not-authoritative@example.test", token: "not-a-token" }; const mock = responder({ avasamProducts: [supplierProduct] });
  await checkout(mock, [{ id: avasam.id, quantity: 1 }], { email: "customer@example.test", telephone: "07123456789" }, undefined, { avasamCache: cache, now: () => 6_000_000 });
  assert.deepEqual(Object.keys(cache.value.products[0]).sort(), ["description", "id", "image", "name", "price", "sku", "status", "supplier"]); assert.doesNotMatch(JSON.stringify(cache.value), /customer@example\.test|not-a-token/);
});
