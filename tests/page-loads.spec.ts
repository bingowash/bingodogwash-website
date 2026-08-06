import { expect, test } from "@playwright/test";

function apiResponse(pathname: string) {
  if (pathname.endsWith("/api/avasam/products")) {
    return { ok: true, live: true, liveConfigured: true, refreshedAt: "2026-07-31T12:00:00.000Z", products: [] };
  }

  if (pathname.endsWith("/api/ebay/products")) {
    return { ok: true, products: [] };
  }

  if (pathname.endsWith("/api/etsy/products")) {
    return { ok: true, enabled: true, products: [] };
  }

  if (pathname.endsWith("/api/professionals/stats")) {
    return { ok: true, foundingApproved: 0, foundingLimit: 100 };
  }

  if (pathname.endsWith("/api/professionals/directory")) {
    return { ok: true, profiles: [], total: 0 };
  }

  if (pathname.endsWith("/api/competitions/top-dog-2026/dashboard")) {
    return {
      ok: true,
      competition: {
        status: "open",
        prizeDisplay: "£250.00",
        rules: "One entry per dog.\nPhotos must show the entered dog.",
        closesAt: "2026-12-31T23:59:59.000Z",
      },
      stats: {
        totalEntries: 0,
        totalMoneyRaisedDisplay: "£0.00",
      },
    };
  }

  if (pathname.endsWith("/api/competitions/top-dog-2026/gallery")) {
    return { ok: true, entries: [] };
  }

  if (pathname.endsWith("/api/competitions/top-dog-2026/leaderboard")) {
    return { ok: true, entries: [], votingEnabled: false };
  }

  return { ok: true };
}

const pages = [
  "/",
  "/about.html",
  "/account.html",
  "/admin/",
  "/admin/competition.html",
  "/admin/gift-cards.html",
  "/admin/stripe.html",
  "/admin/marketing.html",
  "/admin/professionals.html",
  "/admin-competition.html",
  "/admin-gift-cards.html",
  "/admin-marketing.html",
  "/admin-professionals.html",
  "/admin.html",
  "/cart.html",
  "/contact.html",
  "/dog-walker-application-success.html",
  "/dog-walker-club.html",
  "/faq.html",
  "/find-a-professional.html",
  "/gift-card-balance.html",
  "/gift-card-success.html",
  "/gift-cards.html",
  "/giveaway.html",
  "/product.html",
  "/professional.html",
  "/shop.html",
  "/thank-you.html",
  "/top-dog-competition.html",
  "/top-dog-thank-you.html",
  "/top-dog.html",
  "/wash-station-qr.html",
  "/wash.html",
];

for (const path of pages) {
  test(`${path} loads correctly`, async ({ page }) => {
    const browserErrors: string[] = [];

    await page.route("**/api/**", async (route) => {
      const url = new URL(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(apiResponse(url.pathname)),
      });
    });

    await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "window.turnstile={render:()=> 'smoke-test-widget',reset:()=>{}};",
      });
    });

    page.on("pageerror", (error) => {
      browserErrors.push(error.message);
    });

    page.on("console", (message) => {
      if (message.type() === "error") {
        browserErrors.push(message.text());
      }
    });

    page.on("response", (response) => {
      const url = new URL(response.url());
      if (
        url.origin === "http://localhost:3000" &&
        !url.pathname.startsWith("/api/") &&
        response.status() >= 400
      ) {
        browserErrors.push(`${response.status()} ${url.pathname}`);
      }
    });

    const response = await page.goto(path, {
      waitUntil: "load",
      timeout: 30_000,
    });

    expect(response, `No response received for ${path}`).not.toBeNull();
    expect(
      response?.status(),
      `${path} returned an unsuccessful status`
    ).toBeLessThan(400);

    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(150);

    const bodyText = await page.locator("body").innerText();
    expect(
      bodyText.trim().length,
      `${path} appears to be blank`
    ).toBeGreaterThan(0);

    const accessibilityIssues = await page.evaluate(() => {
      const issues: string[] = [];
      const ids = Array.from(document.querySelectorAll("[id]")).map((element) => element.id);
      const duplicateIds = [...new Set(ids.filter((id, index) => id && ids.indexOf(id) !== index))];
      duplicateIds.forEach((id) => issues.push(`Duplicate id: ${id}`));

      document.querySelectorAll<HTMLElement>("input, select, textarea, button").forEach((control) => {
        if (
          control instanceof HTMLInputElement &&
          control.type === "hidden"
        ) return;
        if (
          control.hidden ||
          control.closest("[hidden]") ||
          control.closest('[aria-hidden="true"]')
        ) return;

        const labelled =
          control.getAttribute("aria-label")?.trim() ||
          control.getAttribute("aria-labelledby")?.trim() ||
          control.getAttribute("title")?.trim() ||
          (control instanceof HTMLInputElement ||
          control instanceof HTMLSelectElement ||
          control instanceof HTMLTextAreaElement
            ? Array.from(control.labels || []).some((label) => label.textContent?.trim())
            : control.textContent?.trim());

        if (!labelled) {
          issues.push(
            `Unlabelled ${control.tagName.toLowerCase()}${control.id ? `#${control.id}` : ""}` +
            `${control.getAttribute("name") ? `[name="${control.getAttribute("name")}"]` : ""}` +
            `${control instanceof HTMLInputElement ? `[type="${control.type}"]` : ""}`
          );
        }
      });

      document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
        if (link.hidden || link.closest("[hidden]")) return;
        const name =
          link.getAttribute("aria-label")?.trim() ||
          link.textContent?.trim() ||
          link.querySelector("img")?.alt?.trim();
        if (!name) issues.push(`Unnamed link: ${link.getAttribute("href")}`);
      });

      return issues;
    });
    expect(
      accessibilityIssues,
      `${path} has accessibility naming or duplicate-id issues:\n${accessibilityIssues.join("\n")}`
    ).toEqual([]);

    const layout = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      contentWidth: document.documentElement.scrollWidth,
      offenders: Array.from(document.querySelectorAll("body *"))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            element: element.tagName.toLowerCase(),
            className: element.className,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
          };
        })
        .filter(({ left, right, width }) => width > 0 && (left < -1 || right > document.documentElement.clientWidth + 1))
        .slice(0, 8),
    }));
    expect(
      layout.contentWidth,
      `${path} overflows horizontally: ${layout.contentWidth}px content in a ${layout.viewportWidth}px viewport\n${JSON.stringify(layout.offenders, null, 2)}`
    ).toBeLessThanOrEqual(layout.viewportWidth);

    const menuToggle = page.locator(".menu-toggle");
    if (await menuToggle.isVisible()) {
      await menuToggle.click();
      await expect(menuToggle).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(menuToggle).toHaveAttribute("aria-expanded", "false");
    }

    if (path.startsWith("/admin/") || path === "/admin") {
      const adminNavigation = page.locator('#admin-primary-navigation[aria-label="Admin sections"]');
      await expect(adminNavigation).toHaveCount(1);
      await expect(adminNavigation.getByRole("link", { name: "Overview", exact: true, includeHidden: true })).toHaveAttribute("href", "/admin/");
      await expect(adminNavigation.getByRole("link", { name: "Payments", exact: true, includeHidden: true })).toHaveAttribute("href", "/admin/stripe.html");
      await expect(adminNavigation.getByRole("link", { name: "Marketing", exact: true, includeHidden: true })).toHaveAttribute("href", "/admin/marketing.html");
    }

    expect(
      browserErrors,
      `${path} produced browser errors:\n${browserErrors.join("\n")}`
    ).toEqual([]);
  });
}
