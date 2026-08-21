import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { storefrontSsrTestHelpers } from "../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js";

const { injectStorefrontProducts, prioritizeAvasamDogProducts, publicStorefrontRoute, storefrontProductSlug } = storefrontSsrTestHelpers;
const products = [
  { id: "avasam-HOME", sku: "HOME", name: "Generic storage cabinet", category: "Home", price: 20, image: "https://example.test/home.png" },
  { id: "avasam-DOG1", sku: "DOG1", name: "Dog grooming brush", category: "Pet grooming", price: 12, image: "https://example.test/dog1.png" },
  { id: "avasam-DOG2", sku: "DOG2", name: "Puppy care shampoo", category: "Dog grooming", price: 11, image: "https://example.test/dog2.png" },
  { id: "avasam-DOG3", sku: "DOG3", name: "Canine walking harness", category: "Dog walking", price: 18, image: "https://example.test/dog3.png" },
];

const publicFile = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8");

test("storefront SSR routes cover homepage, shop and product detail", () => {
  assert.equal(publicStorefrontRoute("/"), "/");
  assert.equal(publicStorefrontRoute("/shop.html"), "/shop");
  assert.equal(publicStorefrontRoute("/product.html"), "/product");
});

test("homepage initial HTML prioritises real dog products and embeds hydration data", () => {
  const html = injectStorefrontProducts(publicFile("index.html"), "/", products);
  assert.match(html, /Dog grooming brush/);
  assert.match(html, /Puppy care shampoo/);
  assert.match(html, /Canine walking harness/);
  assert.doesNotMatch(html.match(/SSR_HOME_PRODUCTS_START -->([\s\S]*?)<!-- SSR_HOME_PRODUCTS_END/)?.[1] || "", /Generic storage cabinet/);
  assert.match(html, /data-ssr-avasam-products/);
});

test("shop initial HTML contains names, prices, images and internal product links", () => {
  const html = injectStorefrontProducts(publicFile("shop.html"), "/shop", products);
  assert.match(html, /Dog grooming brush/);
  assert.match(html, /£12\.00/);
  assert.match(html, /https:\/\/example\.test\/dog1\.png/);
  assert.match(html, new RegExp(`/product\\.html\\?id=${storefrontProductSlug(products[1])}`));
  assert.doesNotMatch(html, /Loading products/);
});

test("product detail initial HTML selects the requested live product", () => {
  const selected = products[2];
  const html = injectStorefrontProducts(publicFile("product.html"), "/product", products, storefrontProductSlug(selected));
  assert.match(html, /Puppy care shampoo/);
  assert.match(html, /£11\.00/);
  assert.match(html, /data-add="avasam-dog2"/);
});

test("dog prioritisation is stable and does not mutate supplier records", () => {
  const prioritized = prioritizeAvasamDogProducts(products);
  assert.equal(prioritized[0].id, "avasam-DOG2");
  assert.equal(products[0].id, "avasam-HOME");
});

test("both storefront clients hydrate SSR data and suppress the immediate fetch", () => {
  for (const file of ["site.js", "site-ebay-mobile-fix.js"]) {
    const source = publicFile(file);
    assert.match(source, /serverRenderedAvasamProducts/);
    assert.match(source, /if \(!hydratedAvasamProducts\.length\) loadAvasamProducts\(\)/);
  }
});
