import { expect, test } from "@playwright/test";

test("AI product centre loads, drafts, reviews and confirms distribution safely", async ({ page }) => {
  let generationCalls = 0;
  let distributionCalls = 0;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => sessionStorage.setItem("bingoAdminCoreToken", "test-admin-token"));
  await page.route("**/api/admin/etsy/products", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [{ id: "etsy-1", source: "etsy", title: "Dog Grooming Bow", description: "A 3/8&quot; ribbon bow.", category: "Accessories", price: 1299, currency: "GBP", listing_url: "https://bingodogwash.com/product?id=etsy-1", primary_image: "https://bingodogwash.com/assets/amazon-product-1.jpg" }] }) }));
  await page.route("**/api/admin/marketing", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, connectedPlatforms: { facebook: true, instagram: true }, platformStatus: { facebook: { ok: true, accessiblePageIds: ["page-1", "page-2"] }, instagram: { ok: true } } }) }));
  await page.route("**/api/admin/ai-drafts", async (route) => {
    generationCalls += 1;
    const request = route.request().postDataJSON();
    const single = request.requestedFields?.[0];
    const draft = { productDescription: "A polished grooming bow.", shortDescription: "A neat finishing touch.", socialCaption: "Smart style for dogs.", facebookCaption: "Facebook-ready dog bow.", instagramCaption: "Instagram-ready dog bow. #BingoDogWash", tiktokCaption: "A smart little bow!", marketplaceTitle: "Dog Grooming Bow", marketplaceDescription: "A decorative grooming bow.", seoTitle: "Dog Grooming Bow", seoDescription: "Discover a decorative dog grooming bow.", emailSubject: "A smart finishing touch", emailPreview: "Discover the Dog Grooming Bow." };
    if (single) draft[single as keyof typeof draft] = `Regenerated ${single}`;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, saved: false, publishable: false, draft }) });
  });
  await page.route("**/api/admin/ai-distribution", async (route) => {
    distributionCalls += 1;
    expect(route.request().postDataJSON().confirmed).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 80));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: "partial", results: { facebook: { ok: true, id: "fb-post-1" }, instagram: { ok: false, error: "Authentication required" } } }) });
  });

  await page.goto("/admin/ai-drafts.html");
  await expect(page.getByRole("heading", { name: "AI Product & Distribution Centre" })).toBeVisible();
  await page.locator("[data-product-select]").selectOption("etsy-1");
  await expect(page.locator('[name="name"]')).toHaveValue("Dog Grooming Bow");
  await expect(page.locator('textarea[name="description"]')).toHaveValue('A 3/8" ribbon bow.');

  await page.getByRole("button", { name: "Generate AI Content" }).click();
  await expect(page.locator('[data-ai-output="productDescription"]')).toHaveValue("A polished grooming bow.");
  expect(distributionCalls).toBe(0);
  await page.locator('[data-ai-output="facebookCaption"]').fill("Human-edited Facebook copy.");
  await page.locator('[data-regenerate="instagramCaption"]').click();
  await expect(page.locator('[data-ai-output="instagramCaption"]')).toHaveValue("Regenerated instagramCaption");
  await expect(page.locator('[data-ai-output="facebookCaption"]')).toHaveValue("Human-edited Facebook copy.");
  expect(generationCalls).toBe(2);

  await page.locator('[data-channel="facebook"]').check();
  await page.locator('[data-channel="instagram"]').check();
  await page.locator('[data-channel="email"]').check();
  await page.getByRole("button", { name: "Save Draft" }).first().click();
  await expect(page.locator("[data-draft-history]")).toContainText("Dog Grooming Bow");

  await page.locator("[data-distribute]").click();
  await expect(page.getByRole("heading", { name: "Ready to distribute?" })).toBeVisible();
  const confirm = page.locator("[data-confirm-distribution]");
  await confirm.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.locator("[data-distribution-results]")).toBeVisible();
  await expect(page.locator("[data-result-list]")).toContainText("Published · ID fb-post-1");
  await expect(page.locator("[data-result-list]")).toContainText("Authentication required");
  await expect(page.locator("[data-result-list]")).toContainText("Draft prepared");
  expect(distributionCalls).toBe(1);
});
