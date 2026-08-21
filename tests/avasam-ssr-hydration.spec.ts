import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { storefrontSsrTestHelpers } from "../_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js";

const product = { id: "avasam-DOG1", sku: "DOG1", name: "Live Dog Grooming Brush", category: "Dog grooming", price: 12, image: "https://example.test/dog.png" };
const publicFile = (name: string) => readFileSync(new URL(`../public/${name}`, import.meta.url), "utf8");

test("shop hydrates SSR cards without an immediate Avasam request or duplicate", async ({ page }) => {
  const html = storefrontSsrTestHelpers.injectStorefrontProducts(publicFile("shop.html"), "/shop", [product]);
  let requests = 0;
  await page.route("**/api/avasam/products**", route => { requests += 1; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, live: true, products: [product] }) }); });
  await page.route("**/api/etsy/products**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [] }) }));
  await page.route("**/api/ebay/products**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [] }) }));
  await page.route("**/shop.html", route => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  await page.goto("/shop.html");
  await expect(page.getByText(product.name, { exact: true })).toHaveCount(1);
  await expect(page.locator('[data-avasam-buy="avasam-dog1"]')).toBeEnabled();
  expect(requests).toBe(0);
});
