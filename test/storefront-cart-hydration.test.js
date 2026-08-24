import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8");

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0; let opened = false;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") { depth += 1; opened = true; }
    if (source[index] === "}" && opened && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`could not extract ${name}`);
}

for (const file of ["site.js", "site-ebay-mobile-fix.js"]) {
  test(`${file} hydrates a mixed basket without null-product crashes`, () => {
    const source = read(file);
    assert.match(source, /avasamStarterProducts\.map\(normalizeAvasamProduct\)\.filter\(Boolean\)/);
    assert.doesNotMatch(source, /map\(normalizeAvasamProduct\)\.filter\(\(product\) => product\.name\)/);
    const stored = ["avasam-S0671070991", "avasam-toy-rope-tug", "avasam-S1005003280444798", "avasam-S0671070991"];
    const writes = [];
    const localStorage = { getItem: () => JSON.stringify(stored), setItem: (key, value) => writes.push([key, JSON.parse(value)]) };
    const cleanBasket = new Function("localStorage", "avasamState", "allProducts", "readBasketProductCache", `${functionSource(source, "cleanBasket")}; return cleanBasket;`)(localStorage, { loading: false }, () => [{ id: "avasam-S0671070991" }], () => ({ "avasam-S1005003280444798": { id: "avasam-S1005003280444798" }, "avasam-toy-rope-tug": { id: "avasam-toy-rope-tug" } }));
    assert.deepEqual(cleanBasket(), ["avasam-S0671070991", "avasam-S1005003280444798", "avasam-S0671070991"]);
    assert.deepEqual(writes, [["bingoBasket", ["avasam-S0671070991", "avasam-S1005003280444798", "avasam-S0671070991"]]]);
  });
}
