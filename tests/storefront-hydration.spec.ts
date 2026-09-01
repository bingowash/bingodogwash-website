import { expect, test } from "@playwright/test";

const verifiedEtsyUrl = "https://www.etsy.com/strfrnt/sd5a8vu67gupclza/share?url=https%3A%2F%2Fwww.etsy.com%2Fuk%2Fstorefront%2Fsd5a8vu67gupclza&product_page_id=19";

test("Etsy hydration loads every bounded page once and normalizes public display data", async ({ page }) => {
  const requestedCursors: string[] = [];
  const makeProduct = (index: number) => ({
    id: `etsy-${7000 + index}`,
    source: "etsy",
    sourceProductId: String(7000 + index),
    name: index === 0 ? "Dog Groomer&#39;s Brush &amp; Comb" : `Paginated Etsy Dog Product ${index + 1}`,
    category: index === 0 ? "1027" : "Dog Grooming Tools",
    supplier: "Etsy",
    paymentProvider: "Etsy",
    externalUrl: `${verifiedEtsyUrl}&listing=${7000 + index}`,
    affiliateReviewStatus: "approved",
    affiliateVerificationStatus: "match",
  });
  const firstPage = Array.from({ length: 50 }, (_, index) => makeProduct(index));
  const secondPage = [makeProduct(49), ...Array.from({ length: 6 }, (_, index) => makeProduct(index + 50))];
  await page.route("**/api/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
  await page.route("**/api/avasam/products**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, live: true, products: [] }) }));
  await page.route("**/api/ebay/products**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [] }) }));
  await page.route("**/api/etsy/products**", route => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor") || "";
    requestedCursors.push(cursor);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(cursor
        ? { ok: true, enabled: true, products: secondPage, hasMore: false, nextCursor: "" }
        : { ok: true, enabled: true, products: firstPage, hasMore: true, nextCursor: "page-2" })
    });
  });
  await page.goto("/shop.html");
  await expect(page.locator('[data-products] a[href*="&listing="]')).toHaveCount(10);
  expect(requestedCursors).toEqual(["", "page-2"]);
  const ids = await page.locator('[data-products] a[href*="&listing="]').evaluateAll(elements => elements.map(element => element.getAttribute("href")));
  expect(new Set(ids).size).toBe(10);
  const firstCard = page.locator('[data-products] a[href*="listing=7000"]').locator("xpath=ancestor::article");
  await expect(firstCard).toContainText("Dog Groomer's Brush & Comb");
  await expect(firstCard).toContainText("Etsy Dog Products");
  await expect(firstCard.locator("[data-buy-now], [data-avasam-buy], [data-add]")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("bingoBasket") || "[]"))).not.toContain("etsy-7000");
});
