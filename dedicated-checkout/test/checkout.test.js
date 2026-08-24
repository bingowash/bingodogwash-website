import assert from "node:assert/strict";
import test from "node:test";
import { avasamSku, createWorker } from "../src/worker.js";

const now = Date.parse("2026-08-24T20:00:00.000Z");
const product = (sku, pence, extra = {}) => ({ sku, public_id: `avasam-${sku}`, name: `Avasam ${sku}`, price_pence: pence, supplier: "Avasam", status: "Available", availability: "Available", image: "https://example.com/p.jpg", description: "Trusted", updated_at: new Date(now).toISOString(), last_seen_at: new Date(now).toISOString(), active: 1, ...extra });
function db(rows = {}) { return { prepare() { let sku = ""; return { bind(value) { sku = value; return this; }, first: async () => rows[sku] || null }; } }; }
function responder() { const calls = []; return { calls, fetch: async (url, init = {}) => { calls.push({ url: String(url), init }); if (String(url).includes("stripe")) return new Response(JSON.stringify({ url: "https://checkout.stripe.test/session" })); if (String(url).includes("formsubmit")) return new Response("ok"); if (String(url).includes("appscenic")) return new Response(JSON.stringify({ products: [] })); throw new Error(`unexpected ${url}`); } }; }
async function checkout(mock, items, rows) { return createWorker({ fetchImpl: mock.fetch, now: () => now }).fetch(new Request("https://bingo-checkout.bingowash.workers.dev/", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://bingodogwash.com" }, body: JSON.stringify({ items }) }), { STRIPE_SECRET_KEY: "test", AVASAM_CATALOGUE_DB: db(rows) }); }
function stripe(mock) { return mock.calls.find((call) => call.url.includes("stripe")); }

test("Avasam SKU lookup uses D1 and sends £67.50 server price to Stripe without supplier HTTP", async () => {
  const m = responder(); const r = await checkout(m, [{ id: "avasam-S0671538415", quantity: 1, price: 0.01 }], { S0671538415: product("S0671538415", 6750) });
  assert.equal(r.status, 200); assert.match(stripe(m).init.body, /unit_amount%5D=6750/); assert.equal(m.calls.some((call) => /avasam|appscenic/.test(call.url)), false);
});
test("Avasam ID normalization uses one canonical uppercase SKU for lowercase, uppercase, and raw inputs", async () => {
  for (const id of ["avasam-s0671537482", "avasam-S0671537482", "S0671537482", "avasam-S0671538415", "avasam-S0671070991"]) assert.equal(avasamSku(id), id.replace(/^avasam-/i, "").toUpperCase());
  const m = responder(); const r = await checkout(m, [{ id: "avasam-s0671537482", quantity: 1, price: 9999 }], { S0671537482: product("S0671537482", 2788) });
  assert.equal(r.status, 200); assert.match(stripe(m).init.body, /unit_amount%5D=2788/); assert.equal(m.calls.some((call) => /avasam|appscenic/.test(call.url)), false);
});
test("two valid lowercase Avasam IDs resolve through D1, while a slug fallback remains fail-closed", async () => {
  const rows = { S0671383496: product("S0671383496", 9374), S0671071188: product("S0671071188", 21160) };
  const valid = responder(); const success = await checkout(valid, [{ id: "avasam-s0671383496", quantity: 1 }, { id: "avasam-s0671071188", quantity: 1 }], rows);
  assert.equal(success.status, 200); assert.match(stripe(valid).init.body, /unit_amount%5D=9374/); assert.match(stripe(valid).init.body, /unit_amount%5D=21160/);
  const invalid = responder(); const failure = await checkout(invalid, [{ id: "avasam-toy-rope-tug", quantity: 1 }], rows);
  assert.equal(failure.status, 400); assert.equal(stripe(invalid), undefined);
});
test("D1 £42 price overrides browser tampering", async () => {
  for (const price of [0.01, 9999]) { const m = responder(); await checkout(m, [{ id: "avasam-S0671070991", quantity: 1, price }], { S0671070991: product("S0671070991", 4200) }); assert.match(stripe(m).init.body, /unit_amount%5D=4200/); }
});
test("unknown, stale, inactive, unavailable and invalid D1 records fail before Stripe", async () => {
  const cases = [{}, { S: product("S", 4200, { last_seen_at: "2026-08-24T19:54:59.999Z" }) }, { S: product("S", 4200, { active: 0 }) }, { S: product("S", 4200, { status: "Out of stock" }) }, { S: product("S", 0) }];
  for (const rows of cases) { const m = responder(); const r = await checkout(m, [{ id: "avasam-S", quantity: 1 }], rows); assert.ok(r.status >= 400); assert.equal(stripe(m), undefined); }
});
test("CORS, success/cancel URLs, GB shipping and order email remain unchanged", async () => {
  const m = responder(); const r = await checkout(m, [{ id: "avasam-S0671070991", quantity: 1 }], { S0671070991: product("S0671070991", 4200) }); const body = stripe(m).init.body; assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://bingodogwash.com"); for (const value of ["success_url=https%3A%2F%2Fbingodogwash.com%2Fshop.html%3Fpayment%3Dsuccess", "cancel_url=https%3A%2F%2Fbingodogwash.com%2Fcart.html%3Fpayment%3Dcancelled", "allowed_countries%5D%5B%5D=GB"]) assert.ok(body.includes(value)); assert.ok(m.calls.some((call) => call.url.includes("formsubmit")));
});
