import assert from "node:assert/strict";
import test from "node:test";
import worker, { etsyTestHelpers } from "../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js";

function makePublishedRows(collection, count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${collection.toLowerCase().replace(/\s+/g, "-")}-${index + 1}`,
    bingo_collection: collection,
    admin_status: "published",
    public_visibility: 1,
  }));
}

test("Bingo Dog Edit capacity fixtures allow exactly 10 per collection and 40 total", () => {
  const walkTen = makePublishedRows("THE WALK", 10);
  const washTen = makePublishedRows("THE WASH", 10);
  const wearTen = makePublishedRows("THE WEAR", 10);
  const loveTen = makePublishedRows("THE LOVE", 10);
  const exactForty = [...walkTen, ...washTen, ...wearTen, ...loveTen];

  const exactFortyResult = etsyTestHelpers.bingoCollectionCapacity([], exactForty, []);
  assert.equal(exactFortyResult.blocked.length, 0);
  assert.equal(exactFortyResult.counts.get("THE WALK"), 10);
  assert.equal(exactFortyResult.counts.get("THE WASH"), 10);
  assert.equal(exactFortyResult.counts.get("THE WEAR"), 10);
  assert.equal(exactFortyResult.counts.get("THE LOVE"), 10);
  assert.equal(exactFortyResult.total, 40);
});

test("Bingo Dog Edit capacity fixtures reject the 11th item in a collection", () => {
  const rows = makePublishedRows("THE WALK", 10);
  const result = etsyTestHelpers.bingoCollectionCapacity([
    { id: "walk-11", bingo_collection: "THE WALK", admin_status: "published", public_visibility: 1 },
  ], rows, []);

  assert.equal(result.blocked.length, 1);
  assert.match(result.blocked[0].reason, /THE WALK.*10/);
});

test("Bingo Dog Edit capacity fixtures reject the 41st total item", () => {
  const rows = [
    ...makePublishedRows("THE WALK", 10),
    ...makePublishedRows("THE WASH", 10),
    ...makePublishedRows("THE WEAR", 10),
    ...makePublishedRows("THE LOVE", 10),
  ];
  const result = etsyTestHelpers.bingoCollectionCapacity([
    { id: "extra-41", bingo_collection: "THE WALK", admin_status: "published", public_visibility: 1 },
  ], rows, []);

  assert.equal(result.blocked.length, 1);
  assert.match(result.blocked[0].reason, /TOTAL BINGO DOG EDIT CAPACITY IS 40 PUBLISHED PRODUCTS|40.*TOTAL/i);
});

test("HE LOVE Etsy source section maps to the canonical THE LOVE public collection", () => {
  assert.equal(etsyTestHelpers.normalizeBingoEtsyCollection("HE LOVE"), "THE LOVE");
  assert.equal(etsyTestHelpers.normalizeBingoEtsyCollection("THE LOVE"), "THE LOVE");
});

function verifiedEtsyRow(id, collection, overrides = {}) {
  const listingUrl = `https://www.etsy.com/uk/listing/${id}/dog-product`;
  const affiliateUrl = etsyTestHelpers.rakutenFallbackDeepLink(listingUrl);
  return {
    id: `db-${id}`,
    source: "etsy",
    external_listing_id: String(id),
    etsy_feed_provenance: "creator_storefront",
    bingo_collection: collection,
    title: `Dog product ${id}`,
    category: "Dog Products",
    listing_url: listingUrl,
    original_listing_url: listingUrl,
    price: 1299,
    currency: "GBP",
    admin_status: "published",
    public_visibility: 1,
    affiliate_url: affiliateUrl,
    affiliate_verified_url: affiliateUrl,
    affiliate_final_url: listingUrl,
    affiliate_destination_listing_id: String(id),
    affiliate_verification_status: "match",
    affiliate_verified_at: "2026-09-01T12:00:00.000Z",
    affiliate_review_status: "approved",
    affiliate_reviewed_at: "2026-09-01T12:01:00.000Z",
    affiliate_reviewed_by: "admin",
    affiliate_provider: "rakuten",
    affiliate_program: "etsy_creator_collective_uk",
    affiliate_storefront: "Concordia Mercatura",
    ...overrides,
  };
}

function memoryEtsyDb(rows) {
  return {
    prepare(sql) {
      const statement = {
        values: [],
        bind(...values) { statement.values = values; return statement; },
        async all() {
          if (/FROM etsy_products/.test(sql)) {
            if (/\(id IN/.test(sql)) {
              const selected = new Set(statement.values.filter((value) => String(value).startsWith("db-") || /^\d+$/.test(String(value))));
              return { results: rows.filter((row) => selected.has(row.id) || selected.has(row.external_listing_id)) };
            }
            if (/admin_status = 'published'/.test(sql)) {
              return { results: rows.filter((row) => row.admin_status === "published" && Number(row.public_visibility) === 1) };
            }
            return { results: rows };
          }
          return { results: [] };
        },
        async run() {
          if (/UPDATE etsy_products SET admin_status = \?, public_visibility = \?/.test(sql)) {
            const [status, visibility, , ...ids] = statement.values;
            const selected = new Set(ids.filter((value) => String(value).startsWith("db-")));
            rows.forEach((row) => {
              if (selected.has(row.id)) {
                row.admin_status = status;
                row.public_visibility = visibility;
              }
            });
          }
          if (/UPDATE etsy_products SET bingo_collection = \?, bingo_slot = NULL, updated_at = \?/.test(sql)) {
            const [collection, , ...ids] = statement.values;
            const selected = new Set(ids.filter((value) => String(value).startsWith("db-")));
            rows.forEach((row) => { if (selected.has(row.id)) row.bingo_collection = collection; });
          }
          if (/UPDATE etsy_products SET admin_status = 'hidden', public_visibility = 0/.test(sql)) {
            const removedId = statement.values[1];
            const row = rows.find((candidate) => candidate.id === removedId);
            if (row) { row.admin_status = "hidden"; row.public_visibility = 0; }
          }
          if (/UPDATE etsy_products SET bingo_collection = \?, bingo_slot = NULL, admin_status = 'published'/.test(sql)) {
            const [collection, , addedId] = statement.values;
            const row = rows.find((candidate) => candidate.id === addedId);
            if (row) { row.bingo_collection = collection; row.admin_status = "published"; row.public_visibility = 1; }
          }
          return { success: true };
        },
      };
      return statement;
    },
  };
}

test("public Bingo Dog Edit serves four canonical groups, caps each at ten, and omits unverified products", async () => {
  const rows = [
    ...Array.from({ length: 11 }, (_, index) => verifiedEtsyRow(1000 + index, "THE WALK")),
    verifiedEtsyRow(2000, "THE WASH"),
    verifiedEtsyRow(3000, "HE LOVE"),
    verifiedEtsyRow(4000, "THE WEAR", { affiliate_url: "", affiliate_verified_url: "", affiliate_verification_status: "unverified" }),
    verifiedEtsyRow(4500, "THE WALK", { etsy_feed_provenance: "owned_shop" }),
  ];
  const response = await worker.fetch(new Request("https://bingodogwash.com/api/etsy/products?bingoEdit=1"), {
    ETSY_FEATURE_ENABLED: "true",
    GIFT_CARD_DB: memoryEtsyDb(rows),
  });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(data.collections.map((collection) => collection.name), ["THE WALK", "THE WASH", "THE WEAR", "THE LOVE"]);
  assert.deepEqual(data.collections.map((collection) => collection.products.length), [10, 1, 0, 1]);
  assert.equal(data.count, 12);
  assert.equal(data.products.some((product) => product.sourceProductId === "4000"), false);
  assert.ok(data.products.every((product) => product.externalUrl.startsWith("https://click.linksynergy.com/deeplink")));
});

test("an admin hide propagates to the public Bingo Dog Edit without a redeploy", async () => {
  const row = verifiedEtsyRow(5000, "THE WALK");
  const db = memoryEtsyDb([row]);
  const adminResponse = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/hide", {
    method: "POST",
    headers: { Authorization: "Bearer admin-token", "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [row.id] }),
  }), { ADMIN_API_TOKEN: "admin-token", ETSY_FEATURE_ENABLED: "true", GIFT_CARD_DB: db });
  assert.equal(adminResponse.status, 200);
  const publicResponse = await worker.fetch(new Request("https://bingodogwash.com/api/etsy/products?bingoEdit=1"), {
    ETSY_FEATURE_ENABLED: "true",
    GIFT_CARD_DB: db,
  });
  const data = await publicResponse.json();
  assert.equal(data.count, 0);
  assert.equal(data.collections.find((collection) => collection.name === "THE WALK").products.length, 0);
});

test("admin move and replace actions mutate only Creator Storefront verified Etsy curation rows", async () => {
  const current = verifiedEtsyRow(6000, "THE WALK");
  const replacement = verifiedEtsyRow(6001, "THE WEAR", { admin_status: "review", public_visibility: 0 });
  const db = memoryEtsyDb([current, replacement]);
  const env = { ADMIN_API_TOKEN: "admin-token", ETSY_FEATURE_ENABLED: "true", GIFT_CARD_DB: db };
  const headers = { Authorization: "Bearer admin-token", "Content-Type": "application/json" };

  const move = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/bingo-assign", {
    method: "POST",
    headers,
    body: JSON.stringify({ ids: [replacement.id], collection: "THE LOVE" }),
  }), env);
  assert.equal(move.status, 200);
  assert.equal(replacement.bingo_collection, "THE LOVE");

  const replace = await worker.fetch(new Request("https://bingodogwash.com/api/admin/etsy/products/bingo-replace", {
    method: "POST",
    headers,
    body: JSON.stringify({ removeId: current.id, addId: replacement.id, collection: "THE WALK" }),
  }), env);
  assert.equal(replace.status, 200);
  assert.equal(current.admin_status, "hidden");
  assert.equal(current.public_visibility, 0);
  assert.equal(replacement.bingo_collection, "THE WALK");
  assert.equal(replacement.admin_status, "published");
  assert.equal(replacement.public_visibility, 1);
});
