import { expect, test } from "@playwright/test";

test("Approve Verified Matches confirms, paginates, and reports fail-closed totals", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("bingoAdminCoreToken", "test-admin-token"));
  const requests: Array<Record<string, unknown>> = [];
  const dialogs: string[] = [];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/admin/etsy/products/affiliate-approve-verified" && request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      requests.push(body);
      const firstPage = !body.afterId;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(firstPage
          ? { ok: true, processed: 50, approved: 49, blocked: 1, mismatch: 1, missingDestination: 0, invalidAffiliate: 0, failed: 0, hasMore: true, nextAfterId: "etsy-page-50" }
          : { ok: true, processed: 3, approved: 2, blocked: 1, mismatch: 0, missingDestination: 0, invalidAffiliate: 1, failed: 0, hasMore: false, nextAfterId: "etsy-page-53" })
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [], logs: [], connection: {} }) });
  });

  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });

  await page.goto("/admin/");
  await page.getByRole("button", { name: "Approve Verified Matches" }).click();
  await expect.poll(() => requests.length).toBe(2);
  await expect.poll(() => dialogs.length).toBe(2);

  expect(dialogs[0]).toContain("resolved destination listing ID exactly matches their original listing ID");
  expect(dialogs[1]).toContain("51 exact matches approved / 2 blocked");
  expect(dialogs[1]).toContain("Processed: 53");
  expect(dialogs[1]).toContain("mismatch: 1");
  expect(dialogs[1]).toContain("invalid affiliate: 1");
  expect(requests).toEqual([{ ids: [], afterId: "" }, { ids: [], afterId: "etsy-page-50" }]);
});
