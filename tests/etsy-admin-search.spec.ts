import { expect, test } from "@playwright/test";

test("admin Etsy search finds a listing outside the initial batch without mutation", async ({ page }) => {
  let mutationCalls = 0;
  const searchedQueries: string[] = [];
  const selectedActions: Array<{ action: string; ids: string[] }> = [];
  page.on("dialog", dialog => dialog.accept());
  await page.addInitScript(() => sessionStorage.setItem("bingoAdminCoreToken", "test-admin-token"));
  await page.route("**/api/**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, products: [], logs: [], connection: {}, entries: [], pages: [], subscribers: [] })
  }));
  await page.route("**/api/admin/etsy/products**", route => {
    if (route.request().method() !== "GET") {
      mutationCalls += 1;
      const action = new URL(route.request().url()).pathname.split("/").pop() || "";
      const body = route.request().postDataJSON() as { ids?: string[] };
      selectedActions.push({ action, ids: body.ids || [] });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, processed: 1, approved: 1, published: 1, blocked: 0, hasMore: false }) });
    }
    const query = new URL(route.request().url()).searchParams.get("q") || "";
    searchedQueries.push(query);
    const products = query === "1473570446"
      ? [{ id: "", externalListingId: "1473570446", title: "Vintage 00s RUSH Vapor Trails 2002 tour concert t shirt", category: "Etsy Dog Products", priceLabel: "£80.00", status: "published", publicVisibility: true }]
      : [{ id: "etsy-first-page", externalListingId: "100", title: "First page dog product", category: "Etsy Dog Products", priceLabel: "£10.00", status: "published", publicVisibility: true }];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, query, products }) });
  });

  await page.goto("/admin/");
  await expect(page.locator("[data-admin-etsy-products]")).toContainText("First page dog product");
  await page.locator("#admin-etsy-search").fill("1473570446");
  await page.locator("[data-admin-etsy-search]").getByRole("button", { name: "Search" }).click();

  await expect(page.locator("[data-admin-etsy-products]")).toContainText("Vintage 00s RUSH Vapor Trails 2002 tour concert t shirt");
  await expect(page.locator("[data-admin-etsy-products]")).toContainText("Listing ID: 1473570446");
  const searchedCheckbox = page.locator('[data-admin-etsy-product-id="1473570446"]');
  await expect(searchedCheckbox).toHaveAttribute("data-admin-etsy-external-listing-id", "1473570446");
  await expect(page.getByRole("button", { name: "Hide selected" })).toBeVisible();
  await expect(page.locator("[data-admin-etsy-search-status]")).toHaveText("1 matching product.");
  expect(mutationCalls).toBe(0);

  const actions = [
    ["approve", "Approve selected"],
    ["publish", "Publish selected"],
    ["hide", "Hide selected"],
    ["unpublish", "Unpublish selected"],
    ["affiliate-generate-verify", "Generate & Verify Etsy Affiliate Links"],
    ["affiliate-approve-verified", "Approve Verified Matches"],
    ["publish-verified", "Publish Verified Etsy Products"]
  ];
  for (const [, buttonName] of actions) {
    await page.locator('[data-admin-etsy-product-id="1473570446"]').check();
    const actionButton = page.getByRole("button", { name: buttonName, exact: true });
    await actionButton.click();
    await expect.poll(() => selectedActions.length).toBe(actions.findIndex(([, name]) => name === buttonName) + 1);
    await expect(actionButton).toBeEnabled();
    await expect(page.locator('[data-admin-etsy-product-id="1473570446"]')).toBeVisible();
  }

  expect(selectedActions).toEqual(actions.map(([action]) => ({ action, ids: ["1473570446"] })));
  expect(searchedQueries).toContain("1473570446");
  expect(mutationCalls).toBe(actions.length);
});

test("hiding a searched Etsy product reports and refreshes its canonical hidden state", async ({ page }) => {
  const listingId = "1473570446";
  const affiliateUrl = `https://click.linksynergy.com/deeplink?id=test&mid=54080&murl=https%3A%2F%2Fwww.etsy.com%2Flisting%2F${listingId}`;
  let status = "published";
  let publicVisibility = true;
  let hideCalls = 0;

  await page.addInitScript(() => sessionStorage.setItem("bingoAdminCoreToken", "test-admin-token"));
  await page.route("**/api/**", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, products: [], logs: [], connection: {}, entries: [], pages: [], subscribers: [] })
  }));
  await page.route("**/api/admin/etsy/products**", async route => {
    const request = route.request();
    if (request.method() !== "GET") {
      const action = new URL(request.url()).pathname.split("/").pop();
      const body = request.postDataJSON() as { ids?: string[] };
      expect(action).toBe("hide");
      expect(body.ids).toEqual([listingId]);
      hideCalls += 1;
      status = "hidden";
      publicVisibility = false;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, processed: 1, hidden: 1 })
      });
    }

    const query = new URL(request.url()).searchParams.get("q") || "";
    const products = query === listingId ? [{
      id: "",
      externalListingId: listingId,
      title: "Vintage 00s RUSH Vapor Trails 2002 tour concert t shirt",
      category: "Etsy Dog Products",
      priceLabel: "£80.00",
      status,
      publicVisibility,
      affiliateUrl,
      affiliateReviewStatus: "approved",
      affiliateVerificationStatus: "match",
      affiliateGenerationStatus: "VERIFIED MATCH",
      affiliateFinalUrl: `https://www.etsy.com/listing/${listingId}/rush-shirt`,
      affiliateDestinationListingId: listingId
    }] : [];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, query, products })
    });
  });

  await page.goto("/admin/");
  await page.locator("#admin-etsy-search").fill(listingId);
  await page.locator("[data-admin-etsy-search]").getByRole("button", { name: "Search" }).click();

  const productList = page.locator("[data-admin-etsy-products]");
  const checkbox = page.locator(`[data-admin-etsy-product-id="${listingId}"]`);
  await expect(productList).toContainText("Status: Published");
  await expect(productList).toContainText(affiliateUrl);
  await expect(productList).toContainText("Reviewapproved");
  await expect(productList).toContainText("VerificationVERIFIED MATCH");

  await checkbox.check();
  await page.getByRole("button", { name: "Hide selected", exact: true }).click();

  await expect(page.locator("[data-admin-etsy-search-status]")).toHaveText("1 Etsy product hidden");
  await expect(productList).toContainText("Vintage 00s RUSH Vapor Trails 2002 tour concert t shirt");
  await expect(productList).toContainText(`Listing ID: ${listingId}`);
  await expect(productList).toContainText("Status: Hidden");
  await expect(productList).toContainText("Public visibility: Hidden");
  await expect(productList).not.toContainText("Status: Published");
  await expect(productList).toContainText(affiliateUrl);
  await expect(productList).toContainText("Reviewapproved");
  await expect(productList).toContainText("VerificationVERIFIED MATCH");
  expect(hideCalls).toBe(1);

  await checkbox.check();
  await page.getByRole("button", { name: "Hide selected", exact: true }).click();
  await expect(page.locator("[data-admin-etsy-search-status]")).toHaveText("Selected Etsy products are already hidden.");
  expect(hideCalls).toBe(1);
});
