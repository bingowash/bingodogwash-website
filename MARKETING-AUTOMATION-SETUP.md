# Marketing Automation deployment

The feature is deployed paused by default. Complete these steps before using **Resume Automation**.

1. Apply the additive D1 migration:

   `npx wrangler d1 migrations apply bingo-gift-cards --remote`

2. Store Meta credentials as Worker secrets (enter each value only at Wrangler's secure prompt):

   `npx wrangler secret put META_PAGE_ACCESS_TOKEN`

   `npx wrangler secret put INSTAGRAM_ACCESS_TOKEN`

   `npx wrangler secret put MARKETING_TRACKING_SECRET`

3. Add these non-secret Worker variables in `wrangler.jsonc`, or as dashboard variables:

   - `META_PAGE_ID`: the Facebook Page ID.
   - `META_INSTAGRAM_USER_ID`: the Instagram professional account ID returned by Instagram Login.
   - `META_INSTAGRAM_USERNAME`: the matching Instagram username.

`META_PAGE_ACCESS_TOKEN` must be a valid Page access token for `META_PAGE_ID`. `INSTAGRAM_ACCESS_TOKEN` must be the Instagram Login token for `META_INSTAGRAM_USER_ID` and must have `instagram_business_content_publish`. Both tokens are read only on the server and are never returned by the admin API.

4. Deploy the Worker, open `/admin/marketing.html`, unlock it with the existing admin token, keep automation paused, and run **Safe Preflight**. Only run a test post after both read-only platform checks pass.

5. After confirming both platform results in the log, choose a UTC schedule and select **Resume Automation**.

The existing 15-minute cron invokes the marketing scheduler in the background. The configured minute must therefore be `00`, `15`, `30`, or `45`.

## Analytics hooks

Social links automatically pass through `/api/marketing/track` to record clicks and then redirect to the original product URL with UTM parameters. Engagement and sale events can be recorded by an authorised server-side integration using:

`POST /api/marketing/track?campaign=CAMPAIGN_CODE&event=engagement`

`POST /api/marketing/track?campaign=CAMPAIGN_CODE&event=sale`

Send `X-Marketing-Tracking-Secret` with those server-to-server requests. Click events remain public because customers must be able to follow campaign links.

No existing analytics or checkout behavior is changed.
