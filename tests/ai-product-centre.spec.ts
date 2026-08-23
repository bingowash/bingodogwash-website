import { expect, test } from "@playwright/test";

test("AI product centre loads, drafts, reviews and confirms distribution safely", async ({ page }) => {
  let generationCalls = 0;
  let distributionCalls = 0;
  let tiktokDraftCalls = 0;
  let manualDiscoveryBody: Record<string, unknown> | undefined;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => sessionStorage.setItem("bingoAdminCoreToken", "test-admin-token"));
  await page.route("**/api/admin/catalogue", (route) => { expect(new URL(route.request().url()).origin).toBe("http://localhost:3000"); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [{ id: "etsy-1", source: "etsy", externalListingId: "12345", title: "Dog Grooming Bow", description: "A 3/8&quot; ribbon bow.", category: "Accessories", price: 12.99, currency: "GBP", publicUrl: "https://bingodogwash.com/product?id=etsy-12345", image: "https://bingodogwash.com/assets/amazon-product-1.jpg" }, { id: "amazon-dog-treats", source: "amazon", sku: "B012DOG", name: "Tracked Dog Treats", category: "Treats", priceLabel: "Price on Amazon", description: "Affiliate dog treats.", publicUrl: "https://www.amazon.co.uk/dp/B012DOG?tag=bingodogwash3-21", image: "https://bingodogwash.com/assets/amazon-product-2.jpg" }] }) }); });
  await page.route("**/api/admin/etsy/products?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [{ id: "db-etsy-1", source: "etsy", externalListingId: "12345", title: "Dog Grooming Bow", description: "A 3/8&quot; ribbon bow.", listingUrl: "https://www.etsy.com/uk/listing/12345/dog-bow", originalListingUrl: "https://www.etsy.com/uk/listing/12345/dog-bow", publicUrl: "https://bingodogwash.com/product?id=etsy-12345", image: "https://bingodogwash.com/assets/amazon-product-1.jpg", affiliateReviewStatus: "draft", affiliateVerificationStatus: "unverified" }] }) }));
  await page.route("**/api/admin/marketing", (route) => { expect(new URL(route.request().url()).origin).toBe("http://localhost:3000"); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, connectedPlatforms: { facebook: true, instagram: true }, platformStatus: { facebookPrimary: { ok: true, accessiblePageIds: ["page-1", "page-2"] }, instagram: { ok: true } } }) }); });
  await page.route("**/api/tiktok/status", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, tiktok: { connected: true, scopesAvailable: ["user.info.basic", "video.upload"], directPostEnabled: false, accounts: { creator: { connected: true }, marketing: { connected: true } } } }) }));
  await page.route("**/api/admin/distribution-channels", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, channels: { email: { status:"draft_only", label:"Draft only", ready:false, missing:["AI_EMAIL_FROM"] }, googleMerchant: { status:"configuration_error", label:"Configuration error", ready:false, missing:["GOOGLE_MERCHANT_CLIENT_ID"] }, ebay: { status:"draft_only", label:"Draft only", ready:false, missing:["eBay seller OAuth/Inventory connector"] } } }) }));
  await page.route("**/api/admin/prospecting/run", async (route) => { manualDiscoveryBody=route.request().postDataJSON(); await route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,prospectsFound:5,prospectsQueued:0,blocked:5,searchApiCost:0.09,partial:false})}); });
  await page.route("**/api/admin/prospecting?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok:true, capability:{prospectingEnabled:false,manualProspectingEnabled:true,sendingEnabled:false,campaignProvider:"brevo",campaignProviderReady:false}, stats:{shown:2,lastRun:null}, prospects:[{id:"prospect-1",business_name:"Dog Grooming Ltd",business_type:"dog groomer",location:"London",domain:"dogs.example",email:"info@dogs.example",subscriber_type:"corporate",subscriber_type_evidence:"Companies House record",pecr_status:"corporate_no_pecr_consent_required",consent_recorded:0,soft_opt_in_recorded:0,lia_basis_recorded:0,lia_status:"not_recorded",source:"google_places",google_place_id:"ChIJ-test-place-id",compliance_status:"lia_required",status:"new",message_id:"message-1",message_status:"approved",approved:true},{id:"prospect-2",business_name:"Historic Pet Shop",business_type:"pet shop",location:"Kent",domain:"historic.example",email:"",subscriber_type:"unknown",subscriber_type_evidence:"",pecr_status:"unknown_treated_as_individual",consent_recorded:0,soft_opt_in_recorded:0,lia_basis_recorded:0,lia_status:"not_recorded",source:"business_website",google_place_id:null,compliance_status:"missing_public_email",status:"new",approved:false}] }) }));
  await page.route("**/api/tiktok/draft?*", async (route) => { tiktokDraftCalls += 1; expect(route.request().method()).toBe("POST"); expect(route.request().url()).toContain("context=ai-distribution"); expect(route.request().postDataBuffer()?.length).toBe(4); return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, draftUploaded: true, publishId: "tiktok-draft-1", message: "TikTok draft uploaded." }) }); });
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
    const body = route.request().postDataJSON();
    expect(body.confirmed).toBe(true);
    expect(body.channels).toEqual(["facebook", "instagram"]);
    expect(body.product.instagramDestinationUrl).toBe("https://bingodogwash.com/shop");
    expect(body.content.instagram).toContain("Shop now — link in bio 🐾");
    expect(body.content.instagram).not.toContain("http");
    await new Promise((resolve) => setTimeout(resolve, 80));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: "partial", results: { facebook: { ok: true, id: "fb-post-1" }, instagram: { ok: false, error: "Authentication required" } } }) });
  });

  await page.goto("/admin/ai-drafts.html");
  await expect(page.getByRole("heading", { name: "AI Product & Distribution Centre" })).toBeVisible();
  const channelCheckbox = page.locator('[data-channel="facebook"]');
  await expect(channelCheckbox).toHaveCSS("width", "20px");
  await expect(channelCheckbox).toHaveCSS("height", "20px");
  await expect(page.locator('[data-channel="email"] + strong + span')).toHaveText("Draft only");
  await expect(page.locator('[data-channel="googleMerchant"] + strong + span')).toHaveText("Configuration error");
  await expect(page.locator('[data-channel="ebay"] + strong + span')).toHaveText("Draft only");
  await expect(page.locator('[data-channel="facebook"] + strong + span')).toHaveText("Connected");
  await expect(page.locator('[data-channel="instagram"] + strong + span')).toHaveText("Connected");
  await expect(page.locator('[data-channel="tiktokCreator"] + strong + span')).toHaveText("Connected");
  await expect(page.locator('[data-channel="tiktok"] + strong + span')).toContainText("Connected");
  await expect(page.getByRole("heading", { name: "Customer Finder" })).toBeVisible();
  await expect(page.locator("[data-prospecting-summary]")).toContainText("Ready to search 1 category in Maidstone");
  await page.locator("[data-prospecting-location]").selectOption({label:"London"});
  await page.locator('[data-prospecting-category][value="pet shop"]').check();
  await page.locator("[data-prospecting-budget]").selectOption("0.09");
  await page.locator("[data-prospecting-max]").selectOption("5");
  await page.getByRole("button", {name:"Find Customers Now"}).click();
  await expect(page.locator("[data-prospecting-result]")).toContainText("Businesses found: 5");
  expect(manualDiscoveryBody).toMatchObject({location:"London",categories:["dog groomer","pet shop"],budget:0.09,maxProspects:5});
  await expect(page.locator("[data-prospecting-rows]")).toContainText("Dog Grooming Ltd");
  await expect(page.locator("[data-prospecting-rows]")).toContainText("google_places");
  await expect(page.locator("[data-prospecting-rows]")).toContainText("Place ID: ChIJ-test-place-id");
  await expect(page.locator("[data-prospecting-rows]")).toContainText("Historic Pet Shop");
  await expect(page.locator("[data-prospecting-rows]")).toContainText("business_website");
  await expect(page.locator("[data-prospecting-rows]")).not.toContainText("Place ID not available");
  await expect(page.locator("[data-prospecting-rows]")).toContainText("LIA: not recorded");
  await expect(page.locator("[data-prospecting-rows]")).toContainText("PECR: corporate_no_pecr_consent_required");
  await expect(page.locator("[data-prospecting-rows]")).toContainText("PECR: unknown_treated_as_individual");
  await expect(page.locator("[data-prospecting-rows]")).toContainText("Evidence: not established");
  await expect(page.locator("[data-prospecting-rows]")).toContainText("Approval: not approved");
  const unknownRow=page.locator("[data-prospecting-rows] tr",{hasText:"Historic Pet Shop"});
  await expect(unknownRow.getByRole("button",{name:"Record LIA"})).toBeDisabled();
  await expect(unknownRow.getByRole("button",{name:"Record LIA"})).toHaveAttribute("title",/Unknown is treated as individual/);
  await page.locator("[data-prospecting-filter-location]").fill("Kent");
  await expect(page.locator("[data-prospecting-rows]")).not.toContainText("Dog Grooming Ltd");
  await expect(page.locator("[data-prospecting-rows]")).toContainText("Historic Pet Shop");
  await page.locator("[data-prospecting-filter-location]").fill("");
  const prospectSendButtons = page.locator("[data-prospecting-rows] button", { hasText: "Send" });
  await expect(prospectSendButtons).toHaveCount(2);
  for (const sendButton of await prospectSendButtons.all()) {
    await expect(sendButton).toBeDisabled();
    await expect(sendButton).toHaveAttribute("title", /Brevo campaign sending is not ready/);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-channel-grid]")).toBeVisible();
  await page.locator("[data-product-search]").fill("B012DOG");
  await expect(page.locator("[data-product-select] option")).toHaveCount(2);
  await page.locator("[data-product-select]").selectOption("amazon-dog-treats");
  await expect(page.locator('[name="url"]')).toHaveValue("https://www.amazon.co.uk/dp/B012DOG?tag=bingodogwash3-21");
  await page.locator("[data-product-search]").fill("");
  await page.locator("[data-product-select]").selectOption("etsy-1");
  await expect(page.locator('[name="name"]')).toHaveValue("Dog Grooming Bow");
  await expect(page.locator('textarea[name="description"]')).toHaveValue('A 3/8" ribbon bow.');
  await expect(page.locator('[name="url"]')).toHaveValue("https://bingodogwash.com/product?id=etsy-12345");
  await expect(page.locator('[name="url"]')).not.toHaveValue(/undefined/);
  await expect(page.locator('[name="image"]')).toHaveValue("https://bingodogwash.com/assets/amazon-product-1.jpg");
  await expect(page.locator('[name="instagramDestinationUrl"]')).toHaveValue("https://bingodogwash.com/shop");
  await expect(page.locator("[data-instagram-readiness]")).toContainText("Instagram check pending");

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
  await page.locator('[data-channel="tiktok"]').check();
  await page.locator("[data-tiktok-video]").setInputFiles({ name: "campaign.mp4", mimeType: "video/mp4", buffer: Buffer.from([1, 2, 3, 4]) });
  await page.locator('[data-channel="email"]').check();
  await page.getByRole("button", { name: "Save Draft" }).first().click();
  await expect(page.locator('[data-channel-content="instagram"]')).toHaveValue(/Shop now — link in bio 🐾/);
  await expect(page.locator("[data-draft-history]")).toContainText("Dog Grooming Bow");

  await page.locator("[data-distribute]").click();
  await expect(page.getByRole("heading", { name: "Ready to distribute?" })).toBeVisible();
  const confirm = page.locator("[data-confirm-distribution]");
  await confirm.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await expect(page.locator("[data-distribution-results]")).toBeVisible();
  await expect(page.locator("[data-result-list]")).toContainText("Published · ID fb-post-1");
  await expect(page.locator("[data-result-list]")).toContainText("Authentication required");
  await expect(page.locator("[data-result-list]")).toContainText("TikTok draft uploaded. · Publish ID tiktok-draft-1");
  await expect(page.locator("[data-result-list]")).toContainText("Draft prepared");
  await expect(page.locator("[data-distribution-history]")).toContainText("tiktok: success (tiktok-draft-1)");
  expect(distributionCalls).toBe(1);
  expect(tiktokDraftCalls).toBe(1);
});

test("Distribution Channels shows retained expired TikTok roles and independent channel results", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("bingoAdminCoreToken", "test-admin-token"));
  await page.route("**/api/admin/catalogue", (route) => route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,products:[]})}));
  await page.route("**/api/admin/marketing", (route) => route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,platformStatus:{facebookPrimary:{ok:true,accessiblePageIds:["1264938680034651"]},instagram:{ok:true}}})}));
  await page.route("**/api/tiktok/status", (route) => route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,tiktok:{directPostEnabled:true,directPostReady:false,accounts:{creator:{connected:false,accessTokenExpired:true,storedConnectionRetained:true},marketing:{connected:false,accessTokenExpired:true,storedConnectionRetained:true}}}})}));
  await page.route("**/api/admin/distribution-channels", (route) => route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,channels:{email:{status:"needs_configuration",label:"Needs configuration",ready:false},googleMerchant:{status:"status_unavailable",label:"Status unavailable",ready:false},ebay:{status:"draft_only",label:"Draft only",ready:false}}})}));
  await page.route("**/api/admin/prospecting?*", (route) => route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({ok:true,capability:{},stats:{},prospects:[]})}));
  await page.goto("/admin/ai-drafts.html");
  await expect(page.locator('[data-channel="facebook"] + strong + span')).toHaveText("Connected");
  await expect(page.locator('[data-channel="instagram"] + strong + span')).toHaveText("Connected");
  await expect(page.locator('[data-channel="tiktokCreator"] + strong + span')).toHaveText("Access token expired · Stored connection retained");
  await expect(page.locator('[data-channel="tiktok"] + strong + span')).toHaveText("Access token expired · Stored connection retained · Direct Post configured");
  await expect(page.locator('[data-channel="email"] + strong + span')).toHaveText("Needs configuration");
  await expect(page.locator('[data-channel="googleMerchant"] + strong + span')).toHaveText("Status unavailable");
  await expect(page.locator('[data-channel="ebay"] + strong + span')).toHaveText("Draft only");
});

test("AI product centre skips TikTok without video while Meta still publishes", async ({ page }) => {
  let metaCalls = 0;
  let tiktokCalls = 0;
  await page.addInitScript(() => sessionStorage.setItem("bingoAdminCoreToken", "test-admin-token"));
  await page.route("**/api/admin/catalogue", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [{ id: "product-1", source: "etsy", title: "Dog Bow", description: "A bow for dogs.", publicUrl: "https://bingodogwash.com/product/1", image: "https://bingodogwash.com/bow.jpg" }] }) }));
  await page.route("**/api/admin/marketing", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, platformStatus: { facebookPrimary: { ok: true, accessiblePageIds: ["page-1"] }, instagram: { ok: true } } }) }));
  await page.route("**/api/tiktok/status", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, tiktok: { connected: true, scopesAvailable: ["video.upload"], directPostEnabled: false, accounts: { creator: { connected: true }, marketing: { connected: true } } } }) }));
  await page.route("**/api/tiktok/draft?*", (route) => { tiktokCalls += 1; return route.abort(); });
  await page.route("**/api/admin/ai-distribution", (route) => { metaCalls += 1; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: "success", results: { facebook: { ok: true, id: "facebook-success" } } }) }); });
  await page.goto("/admin/ai-drafts.html");
  await page.locator("[data-product-select]").selectOption("product-1");
  await page.locator('[data-channel="facebook"]').check();
  await page.locator('[data-channel="tiktok"]').check();
  await page.locator("[data-distribute]").click();
  await expect(page.locator("[data-confirm-summary]")).toContainText("No TikTok video was selected. TikTok was skipped.");
  await page.locator("[data-confirm-distribution]").click();
  await expect(page.locator("[data-result-list]")).toContainText("Published · ID facebook-success");
  await expect(page.locator("[data-result-list]")).toContainText("No TikTok video was selected. TikTok was skipped.");
  expect(metaCalls).toBe(1);
  expect(tiktokCalls).toBe(0);
  await page.locator("[data-tiktok-video]").setInputFiles({ name: "campaign.mp4", mimeType: "video/mp4", buffer: Buffer.from([1, 2, 3]) });
  await page.locator("[data-distribute]").click();
  await page.locator("[data-confirm-distribution]").click();
  await expect(page.locator("[data-result-list]")).toContainText("Published · ID facebook-success");
  await expect(page.locator("[data-result-list]")).toContainText("Failed to fetch");
  expect(metaCalls).toBe(2);
  expect(tiktokCalls).toBe(1);
});

test("enabled TikTok Direct Post failure cannot block Facebook or Instagram", async ({ page }) => {
  let metaCalls = 0;
  let directCalls = 0;
  await page.addInitScript(() => sessionStorage.setItem("bingoAdminCoreToken", "test-admin-token"));
  await page.route("**/api/admin/catalogue", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [{ id: "product-direct", source: "etsy", title: "Dog Towel", description: "A towel for dogs.", publicUrl: "https://bingodogwash.com/product/direct", image: "https://bingodogwash.com/towel.jpg" }] }) }));
  await page.route("**/api/admin/marketing", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, platformStatus: { facebookPrimary: { ok: true, accessiblePageIds: ["page-1"] }, instagram: { ok: true } } }) }));
  await page.route("**/api/tiktok/status", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, tiktok: { connected: true, directPostEnabled: true, directPostReady: true, scopesAvailable: ["video.upload", "video.publish"], accounts: { creator: { connected: true }, marketing: { connected: true } } } }) }));
  await page.route("**/api/tiktok/direct-post?*", async (route) => { directCalls += 1; const url = new URL(route.request().url()); expect(url.searchParams.get("confirmed")).toBe("true"); expect(url.searchParams.get("privacyLevel")).toBe("SELF_ONLY"); return route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, error: "TikTok Direct Post failed safely." }) }); });
  await page.route("**/api/admin/ai-distribution", (route) => { metaCalls += 1; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, status: "success", results: { facebook: { ok: true, id: "facebook-direct" }, instagram: { ok: true, id: "instagram-direct" } } }) }); });
  await page.goto("/admin/ai-drafts.html");
  await page.locator("[data-product-select]").selectOption("product-direct");
  await page.locator('[data-channel="facebook"]').check();
  await page.locator('[data-channel="instagram"]').check();
  await page.locator('[data-channel="tiktok"]').check();
  await page.locator("[data-tiktok-video]").setInputFiles({ name: "direct.mp4", mimeType: "video/mp4", buffer: Buffer.from([1, 2, 3, 4]) });
  await page.locator("[data-distribute]").click();
  await expect(page.locator("[data-confirm-summary]")).toContainText("Direct Post is enabled");
  await page.locator("[data-confirm-distribution]").click();
  await expect(page.locator("[data-result-list]")).toContainText("facebook-direct");
  await expect(page.locator("[data-result-list]")).toContainText("instagram-direct");
  await expect(page.locator("[data-result-list]")).toContainText("TikTok Direct Post failed safely.");
  expect(metaCalls).toBe(1);
  expect(directCalls).toBe(1);
});

test("AI product centre rejects undefined product URLs and reports AI 502 responses", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => sessionStorage.setItem("bingoAdminCoreToken", "test-admin-token"));
  await page.route("**/api/admin/catalogue", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [{ id: "etsy-hidden", externalListingId: "", title: "Hidden Product", description: "A private draft product.", publicUrl: "undefined", listingUrl: "undefined" }] }) }));
  await page.route("**/api/admin/marketing", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Marketing status is temporarily unavailable." }) }));
  await page.route("**/api/admin/ai-drafts", (route) => route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, error: "AI returned an invalid draft. Please try again." }) }));

  await page.goto("/admin/ai-drafts.html");
  await page.locator("[data-product-select]").selectOption("etsy-hidden");
  await expect(page.locator('[name="url"]')).toHaveValue("");
  await expect(page.locator("[data-product-status]")).not.toContainText("undefined");
  await expect(page.locator("[data-ai-message]")).toContainText("Publishing remains disabled");
  await page.getByRole("button", { name: "Generate AI Content" }).click();
  await expect(page.locator("[data-ai-result-status]")).toHaveText("AI returned an invalid draft. Please try again.");
  await expect(page.locator('[data-channel="facebook"]')).toBeDisabled();
  await expect(page.locator('[data-channel="instagram"]')).toBeDisabled();
  await expect(page.locator('[data-channel="tiktok"]')).toBeDisabled();
});

test("AI product centre keeps manual mode and offers catalogue retry", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("bingoAdminCoreToken", "test-admin-token"));
  let attempts = 0;
  await page.route("**/api/admin/catalogue", (route) => {
    attempts += 1;
    return route.fulfill(attempts === 1
      ? { status: 502, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Catalogue unavailable." }) }
      : { status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [{ id: "avasam-1", source: "avasam", name: "Dog Harness", category: "Harnesses", sku: "HAR-1", price: 16.99, publicUrl: "https://bingodogwash.com/product.html?id=avasam-1", image: "https://bingodogwash.com/assets/catalog-products/harness.jpg" }] }) });
  });
  await page.route("**/api/admin/marketing", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, platformStatus: {} }) }));
  await page.goto("/admin/ai-drafts.html");
  await expect(page.locator("[data-product-status]")).toHaveText("Unable to load shop products. Retry.");
  await page.locator("[data-product-retry]").click();
  await expect(page.locator("[data-product-select]")).toContainText("Dog Harness");
  await page.locator("[data-product-select]").selectOption("avasam-1");
  await expect(page.locator('[name="price"]')).toHaveValue("£16.99");
  await page.locator("[data-product-select]").selectOption("");
  await expect(page.locator('[name="name"]')).toHaveValue("");
  await expect(page.locator("[data-product-status]")).toContainText("Manual product selected");
});

test("Etsy affiliate controls save an authenticated draft without publishing", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("bingoAdminCoreToken", "test-admin-token"));
  let affiliateBody: Record<string, unknown> | undefined;
  let importBody: Record<string, unknown> | undefined;
  let distributionCalls = 0;
  await page.route("**/api/admin/catalogue", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [{ id: "etsy-456", source: "etsy", externalListingId: "456", name: "Creator bow", description: "Reviewed Etsy bow.", originalListingUrl: "https://www.etsy.com/uk/listing/456/creator-bow", externalUrl: "https://www.etsy.com/uk/listing/456/creator-bow", affiliateProvider: "rakuten", affiliateProgram: "etsy_creator_collective_uk", affiliateStorefront: "Concordia Mercatura", affiliateReviewStatus: "draft" }] }) }));
  await page.route("**/api/admin/etsy/products?*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [{ id: "db-456", source: "etsy", externalListingId: "456", title: "Creator bow", description: "Reviewed Etsy bow.", listingUrl: "https://www.etsy.com/uk/listing/456/creator-bow", originalListingUrl: "https://www.etsy.com/uk/listing/456/creator-bow", affiliateProvider: "rakuten", affiliateProgram: "etsy_creator_collective_uk", affiliateStorefront: "Concordia Mercatura", affiliateReviewStatus: "draft", affiliateVerificationStatus: "unverified" }] }) }));
  await page.route("**/api/admin/etsy/products/import-listing", async (route) => {
    importBody = route.request().postDataJSON();
    expect(new URL(route.request().url()).origin).toBe("http://localhost:3000");
    expect(route.request().headers().authorization).toBe("Bearer test-admin-token");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, imported: true, published: false, message: "Etsy listing imported for review. No product was published.", product: { id: "db-456", source: "etsy", externalListingId: "456", title: "Creator bow", description: "Reviewed Etsy bow.", listingUrl: "https://www.etsy.com/uk/listing/456/creator-bow", originalListingUrl: "https://www.etsy.com/uk/listing/456/creator-bow", affiliateProvider: "rakuten", affiliateProgram: "etsy_creator_collective_uk", affiliateStorefront: "Concordia Mercatura", affiliateReviewStatus: "draft", affiliateVerificationStatus: "unverified" } }) });
  });
  await page.route("**/api/admin/etsy/products/affiliate-draft", async (route) => {
    affiliateBody = route.request().postDataJSON();
    expect(route.request().headers().authorization).toBe("Bearer test-admin-token");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, id: "db-456", affiliateReviewStatus: "draft", adminStatus: "review", publicVisibility: false }) });
  });
  await page.route("**/api/admin/ai-distribution", (route) => { distributionCalls += 1; return route.fulfill({ status: 500, body: "unexpected" }); });
  await page.route("**/api/admin/marketing", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, platformStatus: {} }) }));

  await page.goto("/admin/ai-drafts.html");
  await expect(page.locator("[data-etsy-import]")).toBeHidden();
  await page.locator("[data-product-url-search]").fill("https://www.etsy.com/uk/listing/456/creator-bow");
  await expect(page.locator("[data-etsy-import]")).toBeVisible();
  await expect(page.locator("[data-etsy-import]")).toBeEnabled();
  await page.locator("[data-etsy-import]").click();
  await expect(page.locator("[data-etsy-affiliate]")).toBeVisible();
  await expect(page.locator("[data-product-status]")).toContainText("imported for review");
  await expect(page.locator('[name="originalListingUrl"]')).toHaveValue("https://www.etsy.com/uk/listing/456/creator-bow");
  await expect(page.locator('[name="originalListingUrl"]')).toHaveAttribute("readonly", "");
  await expect(page.locator('[name="affiliateStorefront"]')).toHaveValue("Concordia Mercatura");
  await page.locator('[name="affiliateUrl"]').fill("https://tracking.example.org/click?campaign=reviewed");
  await expect(page.locator('[name="affiliateUrl"]')).toHaveValue("https://tracking.example.org/click?campaign=reviewed");
  await page.locator('[name="affiliateProvenance"]').fill("Human supplied Rakuten reference");
  await expect(page.getByRole("button", { name: "Save affiliate draft" })).toBeEnabled();
  await page.getByRole("button", { name: "Save affiliate draft" }).click();
  await expect.poll(() => affiliateBody).toBeTruthy();
  await expect(page.locator("[data-etsy-affiliate-status]")).toContainText("draft");
  if (!affiliateBody || affiliateBody.id !== "db-456" || affiliateBody.affiliateProvider !== "rakuten" || affiliateBody.affiliateProgram !== "etsy_creator_collective_uk" || affiliateBody.affiliateStorefront !== "Concordia Mercatura" || affiliateBody.affiliateUrl !== "https://tracking.example.org/click?campaign=reviewed") throw new Error(`Unexpected affiliate body: ${JSON.stringify(affiliateBody)}`);
  expect(importBody).toMatchObject({ listingId: "456", listingUrl: "https://www.etsy.com/uk/listing/456/creator-bow" });
  expect(distributionCalls).toBe(0);
});

test("Etsy import button validates URLs and Enter shares the deduplicated import handler", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("bingoAdminCoreToken", "test-admin-token"));
  let importCalls = 0;
  await page.route("**/api/admin/catalogue", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, products: [] }) }));
  await page.route("**/api/admin/marketing", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, platformStatus: {} }) }));
  await page.route("**/api/admin/etsy/products/import-listing", async (route) => {
    importCalls += 1;
    expect(route.request().headers().authorization).toBe("Bearer test-admin-token");
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, product: { id: "db-789", source: "etsy", externalListingId: "789", title: "Imported Etsy item", listingUrl: "https://www.etsy.com/listing/789/item", originalListingUrl: "https://www.etsy.com/listing/789/item", affiliateProvider: "rakuten", affiliateProgram: "etsy_creator_collective_uk", affiliateStorefront: "Concordia Mercatura", affiliateReviewStatus: "draft", affiliateVerificationStatus: "unverified" }, message: "Etsy listing imported for review. No product was published." }) });
  });
  await page.goto("/admin/ai-drafts.html");
  const input = page.locator("[data-product-url-search]");
  const button = page.locator("[data-etsy-import]");
  for (const invalid of ["https://example.com/listing/789/item", "http://www.etsy.com/listing/789/item", "https://www.etsy.com/search?q=dog", "https://www.etsy.com/shop/example"]) {
    await input.fill(invalid);
    await expect(button).toBeHidden();
    await expect(button).toBeDisabled();
  }
  await input.fill("https://www.etsy.com/listing/789/item");
  await expect(button).toBeEnabled();
  await input.evaluate((element) => { element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); });
  await expect(button).toBeDisabled();
  await expect(page.locator("[data-product-status]")).toContainText("imported for review");
  expect(importCalls).toBe(1);
  await expect(page.locator('[name="id"]')).toHaveValue("db-789");
  await expect(page.locator('[name="selectedEtsyListingId"]')).toHaveValue("789");
  await expect(page.locator('[name="originalListingUrl"]')).toHaveValue("https://www.etsy.com/listing/789/item");
  await expect(page.locator('[name="affiliateStorefront"]')).toHaveValue("Concordia Mercatura");
});
