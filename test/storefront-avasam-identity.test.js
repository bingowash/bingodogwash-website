import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8");
function canonicalAvasamCheckoutId(raw, variant = {}) {
  const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
  const publicId = firstValue(raw.public_id, raw.publicId, raw.bingoPublicId, raw.bingo_public_id, variant.public_id, variant.publicId, variant.bingoPublicId, variant.bingo_public_id);
  const publicMatch = String(publicId || "").trim().match(/^avasam-(s\d+)$/i);
  if (publicMatch) return `avasam-${publicMatch[1].toUpperCase()}`;
  const sku = firstValue(raw.sku, raw.SKU, variant.sku, variant.SKU);
  const skuMatch = String(sku || "").trim().match(/^(s\d+)$/i);
  return skuMatch ? `avasam-${skuMatch[1].toUpperCase()}` : "";
}

for (const file of ["site.js", "site-ebay-mobile-fix.js"]) {
  test(`${file} uses only canonical Avasam checkout identities`, () => {
    const source = read(file);
    assert.equal(canonicalAvasamCheckoutId({ public_id: "avasam-S0671383496", sku: "S0000000000" }), "avasam-S0671383496");
    assert.equal(canonicalAvasamCheckoutId({ sku: "S0671071188" }), "avasam-S0671071188");
    assert.equal(canonicalAvasamCheckoutId({ name: "Toy Rope Tug" }), "");
    assert.match(source, /function canonicalAvasamCheckoutId\(raw, variant = \{\}\)/);
    assert.match(source, /raw\.public_id, raw\.publicId/);
    assert.match(source, /\^avasam-\(s\\d\+\)\$\/i/);
    assert.match(source, /const checkoutId = canonicalAvasamCheckoutId\(raw, variant\);\s*if \(!checkoutId\) return null;/);
    assert.match(source, /\^avasam-s\\d\+\$\/i\.test\(String\(id \|\| ""\)\)/);
  });
}
