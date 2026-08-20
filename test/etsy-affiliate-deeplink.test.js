import assert from "node:assert/strict";
import test from "node:test";
import worker, { etsyTestHelpers } from "../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js";

const listingUrl = "https://www.etsy.com/uk/listing/1162091738/personalised-pet-toy-storage-basket?utm_source=chatgpt.com&utm_medium=referral#details";

test("clean Etsy listing URL produces the proven Rakuten Creator Collective deep link", () => {
  const cleaned = etsyTestHelpers.cleanEtsyListingDestination(listingUrl);
  assert.equal(cleaned, "https://www.etsy.com/uk/listing/1162091738/personalised-pet-toy-storage-basket");
  assert.equal(etsyTestHelpers.rakutenAdvertiserMid, "54080");
  assert.equal(etsyTestHelpers.rakutenAffiliateId, "FUdPmdlyOp8");
  const deepLink = new URL(etsyTestHelpers.rakutenFallbackDeepLink(listingUrl));
  assert.equal(deepLink.origin + deepLink.pathname, "https://click.linksynergy.com/deeplink");
  assert.equal(deepLink.searchParams.get("id"), "FUdPmdlyOp8");
  assert.equal(deepLink.searchParams.get("mid"), "54080");
  assert.equal(deepLink.searchParams.get("murl"), cleaned);
  assert.doesNotMatch(deepLink.toString(), /chatgpt|utm_/i);
  assert.equal(etsyTestHelpers.cleanEtsyListingDestination("https://example.com/listing/1162091738/item"), "");
});

test("Rakuten API is preferred when securely configured and secrets are never returned", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://api.linksynergy.com/v1/links/deep_links");
    assert.equal(init.headers.Authorization, "Bearer server-secret-token");
    assert.deepEqual(JSON.parse(init.body), { url: "https://www.etsy.com/uk/listing/1162091738/personalised-pet-toy-storage-basket", advertiser_id: 54080 });
    return new Response(JSON.stringify({ deep_link_url: "https://click.linksynergy.com/deeplink?id=api-result" }), { headers: { "Content-Type": "application/json" } });
  };
  try {
    const generated = await etsyTestHelpers.generateRakutenEtsyDeepLink(listingUrl, { RAKUTEN_DEEP_LINK_API_TOKEN: "server-secret-token" });
    assert.deepEqual(generated, { url: "https://click.linksynergy.com/deeplink?id=api-result", source: "api", destination: "https://www.etsy.com/uk/listing/1162091738/personalised-pet-toy-storage-basket" });
    assert.doesNotMatch(JSON.stringify(generated), /server-secret-token/);
  } finally { globalThis.fetch = originalFetch; }
});

test("Rakuten API network failure falls back to the proven Link Tools format", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("network unavailable"); };
  try {
    const generated = await etsyTestHelpers.generateRakutenEtsyDeepLink(listingUrl, { RAKUTEN_DEEP_LINK_API_TOKEN: "server-secret-token" });
    assert.equal(generated.source, "verified_format");
    assert.equal(generated.url, etsyTestHelpers.rakutenFallbackDeepLink(listingUrl));
    assert.doesNotMatch(JSON.stringify(generated), /server-secret-token/);
  } finally { globalThis.fetch = originalFetch; }
});

function product(id, overrides = {}) {
  const clean = `https://www.etsy.com/uk/listing/${id}/dog-product`;
  return { id: `db-${id}`, source: "etsy", external_listing_id: id, listing_url: clean, original_listing_url: clean, admin_status: "review", public_visibility: 0, affiliate_review_status: "draft", ...overrides };
}

function fakeDb(products) {
  const updates = [];
  return { updates, prepare(sql) {
    const statement = {
      values: [], bind(...values) { statement.values = values; return statement; },
      async all() { return { results: sql.includes("FROM etsy_products") ? products : [] }; },
      async first() { return null; },
      async run() { updates.push({ sql, values: statement.values }); return { success: true }; }
    };
    return statement;
  } };
}

test("bulk generation verifies multiple products and skips an existing valid MATCH", async () => {
  const existingUrl = etsyTestHelpers.rakutenFallbackDeepLink("https://www.etsy.com/uk/listing/333/dog-product");
  const products = [
    product("111"),
    product("222"),
    product("333", { affiliate_url: existingUrl, affiliate_verified_url: existingUrl, affiliate_final_url: "https://www.etsy.com/uk/listing/333/dog-product", affiliate_destination_listing_id: "333", affiliate_verification_status: "match", affiliate_verified_at: "2026-08-20T00:00:00.000Z", affiliate_review_status: "approved", affiliate_reviewed_at: "2026-08-20T00:00:00.000Z", affiliate_reviewed_by: "admin", affiliate_provider: "rakuten", affiliate_program: "etsy_creator_collective_uk", affiliate_storefront: "Concordia Mercatura" })
  ];
  const db = fakeDb(products);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "cloudflare-dns.com") return Response.json({ Answer: [{ type: url.searchParams.get("type") === "AAAA" ? 28 : 1, data: url.searchParams.get("type") === "AAAA" ? "2606:4700:4700::1111" : "1.1.1.1" }] });
    if (url.hostname === "click.linksynergy.com") return new Response(null, { status: 302, headers: { Location: url.searchParams.get("murl") } });
    if (url.hostname.endsWith("etsy.com")) return new Response("ok", { status: 200 });
    throw new Error(`Unexpected fetch ${url}`);
  };
  try {
    const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/affiliate-generate-verify", { method: "POST", headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" }, body: "{}" }), { ADMIN_API_TOKEN: "admin-token", ETSY_FEATURE_ENABLED: "true", GIFT_CARD_DB: db });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.processed, 3);
    assert.equal(data.needsReview, 2);
    assert.equal(data.skipped, 1);
    assert.equal(data.failed, 0);
    assert.equal(db.updates.filter((entry) => /affiliate_verification_status = 'match'/.test(entry.sql)).length, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("verified-only bulk publication publishes eligible records and blocks failed records", async () => {
  const validUrl = etsyTestHelpers.rakutenFallbackDeepLink("https://www.etsy.com/uk/listing/444/dog-product");
  const products = [
    product("444", { affiliate_url: validUrl, affiliate_verified_url: validUrl, affiliate_final_url: "https://www.etsy.com/uk/listing/444/dog-product", affiliate_destination_listing_id: "444", affiliate_verification_status: "match", affiliate_verified_at: "2026-08-20T00:00:00.000Z", affiliate_review_status: "approved", affiliate_reviewed_at: "2026-08-20T00:00:00.000Z", affiliate_reviewed_by: "admin", affiliate_provider: "rakuten", affiliate_program: "etsy_creator_collective_uk", affiliate_storefront: "Concordia Mercatura" }),
    product("555", { affiliate_verification_status: "failed" })
  ];
  const db = fakeDb(products);
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/publish-verified", { method: "POST", headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" }, body: "{}" }), { ADMIN_API_TOKEN: "admin-token", ETSY_FEATURE_ENABLED: "true", GIFT_CARD_DB: db });
  const data = await response.json();
  assert.equal(data.published, 1);
  assert.equal(data.blocked, 1);
  assert.equal(db.updates.some((entry) => /public_visibility = 1/.test(entry.sql)), true);
});
