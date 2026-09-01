import { expect, test, type Page } from "@playwright/test";

const verifiedEtsyUrl = "https://click.linksynergy.com/deeplink?id=FUdPmdlyOp8&mid=54080";
const collections = ["THE WALK", "THE WASH", "THE WEAR", "THE LOVE"];

function product(collection: string, index: number) {
  const listingId = 7000 + index;
  return {
    id: `etsy-${listingId}`,
    source: "etsy",
    sourceProductId: String(listingId),
    name: collection === "THE WALK" && index === 0 ? "Dog Groomer&#39;s Brush &amp; Comb" : `${collection} Etsy product ${index + 1}`,
    category: collection === "THE WALK" && index === 0 ? "1027" : "Dog Grooming Tools",
    supplier: "Etsy",
    paymentProvider: "Etsy",
    externalUrl: `${verifiedEtsyUrl}&listing=${listingId}`,
    affiliateReviewStatus: "approved",
    affiliateVerificationStatus: "match",
  };
}

async function routeShopFeeds(page: Page) {
  await page.route("**/api/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
  await page.route("**/api/avasam/products**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, live: true, products: [] }) }));
  await page.route("**/api/ebay/products**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [] }) }));
}

test("Bingo Dog Edit renders four capped verified Etsy collections without basket controls", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("bingoBasket", JSON.stringify(["etsy-7000"]));
    localStorage.setItem("bingoBasketProducts", JSON.stringify({ "etsy-7000": { id: "etsy-7000", paymentProvider: "Etsy" } }));
  });
  await routeShopFeeds(page);
  await page.route("**/api/etsy/products**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      bingoDogEdit: true,
      collections: collections.map((name, groupIndex) => ({ name, products: Array.from({ length: 10 }, (_, index) => product(name, groupIndex * 10 + index)) })),
    }),
  }));

  await page.goto("/shop.html");
  await expect(page.getByRole("heading", { name: "BINGO DOG EDIT", exact: true })).toBeVisible();
  for (const name of collections) {
    const section = page.locator(`[data-bingo-dog-edit-collection="${name}"]`);
    await expect(section.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(section.locator("article.product-card")).toHaveCount(10);
    await expect(section.locator("[data-buy-now], [data-avasam-buy], [data-add]")).toHaveCount(0);
  }
  await expect(page.locator("[data-bingo-dog-edit] a[href*='click.linksynergy.com']")).toHaveCount(40);
  await expect(page.locator("[data-bingo-dog-edit-collection='THE WALK']")).toContainText("Dog Groomer's Brush & Comb");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("bingoBasket") || "[]"))).not.toContain("etsy-7000");
});

test("a persisted Etsy item is removed before cart or Stripe-product checkout can use it", async ({ page }) => {
  let checkoutWorkerCalls = 0;
  await page.addInitScript(() => {
    localStorage.setItem("bingoBasket", JSON.stringify(["etsy-7000"]));
    localStorage.setItem("bingoBasketProducts", JSON.stringify({ "etsy-7000": { id: "etsy-7000", paymentProvider: "Etsy", externalUrl: "https://click.linksynergy.com/deeplink" } }));
  });
  await routeShopFeeds(page);
  await page.route("https://bingo-checkout.bingowash.workers.dev/**", (route) => {
    checkoutWorkerCalls += 1;
    return route.abort();
  });
  await page.goto("/cart.html");
  await expect(page.locator("[data-cart]")).not.toContainText("etsy-7000");
  await expect(page.locator("[data-product-checkout]")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("bingoBasket") || "[]"))).toEqual([]);
  expect(checkoutWorkerCalls).toBe(0);
});

test.describe("Bingo Dog Edit empty state", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("has no Etsy fallback products or horizontal overflow at 390px", async ({ page }) => {
    await routeShopFeeds(page);
    await page.route("**/api/etsy/products**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "unavailable" }) }));
    await page.goto("/shop.html");
    await expect(page.locator("[data-bingo-dog-edit]")).toContainText("The Bingo Dog Edit is unavailable right now.");
    await expect(page.locator("[data-bingo-dog-edit] article.product-card")).toHaveCount(4);
    await expect(page.locator("[data-bingo-dog-edit] a[href*='etsy.com'], [data-bingo-dog-edit] a[href*='linksynergy.com']")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
