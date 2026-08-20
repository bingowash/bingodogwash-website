import { expect, test } from "@playwright/test";

test("admin Etsy search finds a listing outside the initial batch without mutation", async ({ page }) => {
  let mutationCalls = 0;
  const searchedQueries: string[] = [];
  await page.addInitScript(() => sessionStorage.setItem("bingoAdminCoreToken", "test-admin-token"));
  await page.route("**/api/**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, products: [], logs: [], connection: {}, entries: [], pages: [], subscribers: [] })
  }));
  await page.route("**/api/admin/etsy/products**", route => {
    if (route.request().method() !== "GET") mutationCalls += 1;
    const query = new URL(route.request().url()).searchParams.get("q") || "";
    searchedQueries.push(query);
    const products = query === "1473570446"
      ? [{ id: "etsy-db-1473570446", externalListingId: "1473570446", title: "Vintage RUSH tour concert shirt", category: "Etsy Dog Products", priceLabel: "£80.00", status: "published", publicVisibility: true }]
      : [{ id: "etsy-first-page", externalListingId: "100", title: "First page dog product", category: "Etsy Dog Products", priceLabel: "£10.00", status: "published", publicVisibility: true }];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, query, products }) });
  });

  await page.goto("/admin/");
  await expect(page.locator("[data-admin-etsy-products]")).toContainText("First page dog product");
  await page.locator("#admin-etsy-search").fill("1473570446");
  await page.locator("[data-admin-etsy-search]").getByRole("button", { name: "Search" }).click();

  await expect(page.locator("[data-admin-etsy-products]")).toContainText("Vintage RUSH tour concert shirt");
  await expect(page.locator("[data-admin-etsy-products]")).toContainText("Listing ID: 1473570446");
  await expect(page.locator('[data-admin-etsy-product-id="etsy-db-1473570446"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Hide selected" })).toBeVisible();
  await expect(page.locator("[data-admin-etsy-search-status]")).toHaveText("1 matching product.");
  expect(searchedQueries).toContain("1473570446");
  expect(mutationCalls).toBe(0);
});
