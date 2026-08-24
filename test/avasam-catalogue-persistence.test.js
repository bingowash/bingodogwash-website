import assert from "node:assert/strict";
import test from "node:test";
import { avasamTestHelpers } from "../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js";

function cacheDb() {
  const rows = new Map(); const batches = [];
  return { rows, batches, prepare() { return { bind(...values) { return { values }; } }; }, async batch(statements) { batches.push(statements); for (const statement of statements) { const [sku, publicId, name, pence, supplier, status, availability, image, description, updatedAt, seenAt] = statement.values; rows.set(sku, { sku, publicId, name, pence, supplier, status, availability, image, description, updatedAt, seenAt, active: 1 }); } } };
}
const valid = (extra = {}) => ({ id: "avasam-S0671538415", sku: "S0671538415", name: "Dog Crate", price: 67.5, supplier: "Avasam", status: "Available", image: "https://example.com/a.jpg", description: "Trusted", ignored: "not persisted", ...extra });

test("successful non-empty authoritative catalogue upserts canonical trusted rows in pence", async () => {
  const db = cacheDb(); await avasamTestHelpers.persistAvasamCatalogue([valid(), { id: "avasam-S0671070991", sku: "S0671070991", name: "Playpen", price: 42, supplier: "Avasam" }], { AVASAM_CATALOGUE_DB: db });
  assert.equal(db.rows.get("S0671538415").pence, 6750); assert.equal(db.rows.get("S0671538415").publicId, "avasam-S0671538415"); assert.equal(db.rows.get("S0671070991").pence, 4200); assert.equal(Object.hasOwn(db.rows.get("S0671538415"), "ignored"), false);
});
test("empty, failed and malformed refresh input preserves prior cache while valid siblings upsert", async () => {
  const db = cacheDb(); db.rows.set("S0671538415", { pence: 6750 }); await avasamTestHelpers.persistAvasamCatalogue([], { AVASAM_CATALOGUE_DB: db }); assert.equal(db.rows.get("S0671538415").pence, 6750); assert.equal(db.batches.length, 0);
  await avasamTestHelpers.persistAvasamCatalogue([null, valid({ sku: "", id: "", price: 0 }), valid({ sku: "S0671070991", id: "avasam-S0671070991", price: 42 })], { AVASAM_CATALOGUE_DB: db }); assert.equal(db.rows.get("S0671538415").pence, 6750); assert.equal(db.rows.get("S0671070991").pence, 4200);
});
test("canonical SKU normalization never double-prefixes and repeated refresh updates one logical row", async () => {
  const db = cacheDb(); const first = avasamTestHelpers.persistedAvasamProduct(valid({ sku: "avasam-S0671538415" }), "2026-08-24T20:00:00.000Z"); assert.deepEqual(first.slice(0, 2), ["S0671538415", "avasam-S0671538415"]);
  assert.equal(avasamTestHelpers.persistedAvasamProduct(valid({ sku: "", id: "avasam-toy-rope-tug" }), "2026-08-24T20:00:00.000Z"), null);
  await avasamTestHelpers.persistAvasamCatalogue([valid()], { AVASAM_CATALOGUE_DB: db }); await avasamTestHelpers.persistAvasamCatalogue([valid({ price: 68 })], { AVASAM_CATALOGUE_DB: db }); assert.equal(db.rows.size, 1); assert.equal(db.rows.get("S0671538415").pence, 6800);
});

test("HTTP and network refresh failures retain the prior cache row without a destructive write", async () => {
  for (const failure of [new Response("down", { status: 500 }), new Error("network down")]) {
    const db = cacheDb(); db.rows.set("S0671538415", { pence: 6750, name: "previous" }); const original = globalThis.fetch;
    globalThis.fetch = async () => { if (failure instanceof Error) throw failure; return failure; };
    try { await avasamTestHelpers.refreshAvasamCatalogue({ AVASAM_CONSUMER_KEY: "key", AVASAM_SECRET_KEY: "secret", AVASAM_CATALOGUE_DB: db }); } finally { globalThis.fetch = original; }
    assert.deepEqual(db.rows.get("S0671538415"), { pence: 6750, name: "previous" }); assert.equal(db.batches.length, 0);
  }
});
