# Bingo Dog Wash Admin Control Centre — Gate A Audit

Date: 6 August 2026  
Scope: read-only repository and Cloudflare inventory, test baseline, risk assessment, and implementation proposal.  
Production changes performed: none.

## Executive summary

The current system is a single Cloudflare Worker application with static assets, D1-backed business data, R2 competition photos, email, Stripe, supplier feeds, marketing automation, and several protected admin views. It already contains much of the data and functionality proposed in the original upgrade brief.

The safest useful first implementation is a **non-breaking admin navigation and overview refactor** that reuses existing protected APIs. It should not introduce Amazon, AI drafting, roles, new routes, new bindings, or schema changes.

Three issues should be handled before or within that milestone:

1. The configured `staging` Worker uses the production `bingo-gift-cards` D1 database. It is not safe for mutation testing.
2. Admin authentication is one shared bearer token stored in browser `sessionStorage`; it does not support real users, roles, attribution, or revocation per administrator.
3. `/admin/stripe.html` omits the shared navigation script, causing its mobile/tablet menu behaviour test to fail.

## Repository and Git baseline

- Branch: `main`
- Remote relationship at audit start: synchronized with `origin/main`
- Existing tracked working-tree changes: none
- Audit documents added but not committed:
  - `ADMIN-CONTROL-CENTRE-BRIEF.md`
  - `ADMIN-CONTROL-CENTRE-AUDIT.md`
- Application code changed during audit: none
- Latest production deployment found for Worker `public`: version `83f8e171-a8ba-4e7a-85f6-f88f869408d5`, created 6 August 2026 at 17:41 UTC

## Application architecture

### Worker entry points

- Primary Worker: `_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js`
- Marketing module: `_functions_NOT_FOR_STATIC_UPLOAD/api/marketing.js`
- Marketing-only staging entry: `_functions_NOT_FOR_STATIC_UPLOAD/api/marketing-staging.js`
- Competition module: `_functions_NOT_FOR_STATIC_UPLOAD/api/competition.js`
- Product checkout module: `_functions_NOT_FOR_STATIC_UPLOAD/api/product-checkout.js`

The primary Worker uses `AsyncLocalStorage` to make request bindings available to existing helper functions. Scheduled work uses `ctx.waitUntil()` for marketing, gift-card delivery, and Etsy sync.

### Confirmed admin pages

- `/admin/` — consolidated dashboard, Etsy controls, page controls, product feed, booking monitor, giveaway entries, and newsletter subscribers
- `/admin/competition.html`
- `/admin/gift-cards.html`
- `/admin/marketing.html`
- `/admin/professionals.html`
- `/admin/stripe.html`

Legacy admin URLs are covered by static redirect pages/scripts and page-load tests. They should remain intact.

### Current admin navigation

The main dashboard uses a flat collection of buttons rather than a persistent grouped admin navigation. It links to professionals, gift cards, Stripe, marketing, competition, the public giveaway, and in-page giveaway entries. Individual tools use similar public-site headers, but navigation is not consistent across all admin pages.

This supports a navigation refactor, but not a replacement of the existing pages.

## Authentication and session handling

### Server side

- Protected endpoints use `ADMIN_API_TOKEN` from Worker secrets.
- The token is accepted from `Authorization: Bearer` or `X-Admin-Token`.
- The primary Worker hashes both supplied and expected values and compares fixed-length digests.
- The marketing module performs its own fixed-length digest comparison.
- Stripe webhook requests use HMAC-SHA256 verification and a five-minute timestamp tolerance.
- Security headers include HSTS, CSP, Permissions Policy, COOP, no-sniff, frame protection, and referrer policy.
- API responses default to `Cache-Control: no-store`.

### Browser side

- The admin token is entered into password fields and stored in `sessionStorage`.
- Multiple admin pages reuse `bingoAdminCoreToken` and/or `bingoAdminGiftCardToken`.
- The token is sent as a bearer header and is not written to URLs.

### Limitations

- This is a shared-secret model, not an account/session model.
- `X-Admin-Actor` is browser-controlled and is not a trustworthy identity.
- Individual users, roles, per-user revocation, MFA, and attributable audit events do not exist.
- Any same-origin script execution vulnerability on an unlocked admin page could read the session token. Existing CSP and escaping reduce, but do not eliminate, that risk.

Recommendation: preserve the model for the first UI milestone. Treat identity/RBAC as a separate security architecture project.

## Protected admin API inventory

### Primary Worker

- `/api/admin/newsletter`
- `/api/admin/bookings`
- `/api/admin/stripe`
- `/api/admin/giveaway-entries`
- `/api/giveaway/admin-feed`
- `/api/admin/gift-cards` and subpaths
- `/api/admin/professionals` and subpaths
- `/api/admin/etsy` and subpaths
- `/api/admin/pages` and subpaths

### Marketing module

- `GET /api/admin/marketing`
- `POST /api/admin/marketing/test`
- `POST /api/admin/marketing/oauth/start`
- `GET /api/admin/marketing/oauth/callback` with a one-time OAuth-state guard
- `POST /api/admin/marketing/preflight`
- `POST /api/admin/marketing/diagnostics`
- `POST /api/admin/marketing/pause`
- `POST /api/admin/marketing/resume`
- `POST /api/admin/marketing/schedule`

### Competition module

- `/api/admin/competitions/*` for competition administration and protected photo access

No new admin API is required for the first navigation milestone. A consolidated read-only overview endpoint may be considered only if client-side calls to existing endpoints prove too slow or fragile.

## Public and integration API inventory

The primary Worker also handles:

- site feed status;
- contact and newsletter submission;
- product checkout;
- wash booking checkout and pending-booking lookup;
- giveaway checkout;
- gift-card checkout and balance;
- professional applications, directory, profiles, enquiries, and statistics;
- Etsy OAuth/products;
- Avasam products;
- eBay Browse products and marketplace account-deletion verification;
- Stripe webhook processing;
- public competition dashboards, entries, galleries, leaderboards, sharing, checkout, and photos;
- marketing click/redirect tracking.

These functions are outside the first admin-layout implementation scope.

## Database inventory

### Binding

- Binding: `GIFT_CARD_DB`
- Production database: `bingo-gift-cards`
- Migration directory: `migrations`

### Confirmed production tables

- Gift cards: `gift_cards`, `gift_card_events`, `gift_card_redemptions`
- Professionals: `professional_applications`, `professional_members`, `professional_profiles`, `professional_enquiries`, `professional_rewards`, `professional_referrals`, `professional_founding_slots`, `professional_audit_events`
- Products/pages: `etsy_connections`, `etsy_products`, `etsy_sync_runs`, `etsy_sync_errors`, `site_pages`, `site_audit_events`
- Commerce/community: `wash_bookings`, `giveaway_entries`, `newsletter_subscribers`
- Competitions: `competitions`, `competition_entries`, `competition_photos`, `competition_votes`, `competition_audit_log`, `competition_share_clicks`
- Marketing: `marketing_settings`, `marketing_posts`, `marketing_platform_results`, `marketing_events`, `marketing_one_time_guards`, `marketing_connections`
- Platform-managed: `_cf_KV`, `d1_migrations`

### Schema finding

`marketing_connections` exists in production but is created at runtime by the OAuth callback rather than by a numbered migration. This is schema drift and should be corrected with a new additive migration before relying on the table in another environment. Do not modify an existing migration.

No database change is needed for the first navigation/overview milestone.

## Bindings and Cloudflare resources

### Production `public` Worker

- `ASSETS` — static assets
- `GIFT_CARD_DB` — D1 database `bingo-gift-cards`
- `COMPETITION_PHOTOS` — R2 bucket `bingo-competition-photos`
- `bingo_competition_photos` — legacy-compatible second binding to the same production bucket
- `AI` — Workers AI
- `EMAIL` — Send Email
- Cron: every 15 minutes
- Observability: enabled, full head sampling

### Staging

- `public-staging` has its own staging hostname and staging R2 bucket.
- **Critical:** it points to the same D1 ID and database name as production.
- Etsy is disabled in staging, but any other D1-backed mutation could affect production data.
- `public-marketing-staging` uses a separate `bingo-marketing-staging` database and has publishing disabled.

Recommendation: do not use `public-staging` for mutation testing until it receives a separate D1 database or all mutation paths are proven disabled.

### Account resources observed read-only

- R2: `admin-assets`
- R2: `bingo-competition-photos`

`admin-assets` is not bound in this repository's `public` Worker configuration. Its existence does not establish ownership by this codebase.

An account-wide D1 list request returned a Cloudflare authentication error, while a direct read-only query to the configured production D1 succeeded. Therefore, no claim is made that the account contains only the databases named above.

## Environment variables and secret names

### Version-controlled non-secret variables

- `ETSY_FEATURE_ENABLED`
- `ETSY_SYNC_ENABLED`
- `MARKETING_AI_MODEL`
- `META_INSTAGRAM_USER_ID`
- `META_INSTAGRAM_USERNAME`
- `META_PAGE_ID`
- `META_PAGE_IDS`
- `META_REDIRECT_URI`
- `META_APP_ID`

### Production secret names observed

- `ADMIN_API_TOKEN`
- `AVASAM_CONSUMER_KEY`
- `AVASAM_SECRET_KEY`
- `EBAY_BROWSE_CLIENT_ID`
- `EBAY_BROWSE_CLIENT_SECRET`
- `EBAY_MARKETPLACE_ACCOUNT_DELETION_TOKEN`
- `ETSY_API_KEY`
- `ETSY_API_SECRET`
- `FORM_FROM_EMAIL`
- `INSTAGRAM_ACCESS_TOKEN`
- `MARKETING_TRACKING_SECRET`
- `META_APP_SECRET`
- `META_PAGE_ACCESS_TOKEN`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `TURNSTILE_SECRET`

Only names were listed. No values were read or exposed.

The custom `secrets.required` block in `wrangler.jsonc` names only a subset of the secrets actually used by the application. Because this block is project metadata rather than a complete runtime guarantee, it should not be treated as authoritative health validation.

## Existing integration status and reusable dashboard sources

| Area | Existing source | Suitable for overview |
|---|---|---|
| Bookings | `/api/admin/bookings`, `wash_bookings` | Yes |
| Payments | `/api/admin/stripe` | Yes |
| Gift cards | `/api/admin/gift-cards` | Yes |
| Products/Etsy | `/api/admin/etsy`, feed endpoints | Yes |
| Page status | `/api/admin/pages` | Yes |
| Giveaway | `/api/admin/giveaway-entries` | Yes |
| Newsletter | `/api/admin/newsletter` | Yes |
| Professionals | `/api/admin/professionals/*` | Yes |
| Competitions | `/api/admin/competitions/*` | Yes |
| Marketing | `GET /api/admin/marketing` | Yes |
| Facebook/Instagram | marketing dashboard/preflight sanitized status | Yes, without secrets |
| YouTube | static public link only | Link status only; no API health data |
| Recent system errors | Workers logs, not an existing admin API | No; defer |
| Customers | spread across bookings/orders/entries | No unified customer model; defer |

## Duplicate and overlapping proposals

Already built and should be reused:

- Stripe/payment overview
- Booking monitor
- Gift-card admin
- Competition admin
- Professionals admin
- Marketing overview, schedule, diagnostics, and Meta connection status
- Newsletter list/export
- Giveaway list/export
- Etsy product and sync administration
- Site page status controls

Not currently built and should not be represented as working:

- Amazon importer
- AI draft-review workspace separate from existing automatic marketing-caption generation
- YouTube API integration
- memberships
- unified customer records
- affiliate reporting
- blog/SEO/menu/media management
- individual admin users and roles
- consolidated system error/audit-log viewer

## Validation baseline

### Passed

- `npm test`: 106 passed, 0 failed
- `npm run lint`: passed
- `npm run typecheck`: passed
- `wrangler deploy --dry-run --env=""`: passed; no deployment performed
- Worker bundle: 266.04 KiB upload size, 58.75 KiB gzip in the dry run

### Browser/page suite

The complete Playwright suite contains 132 cases across desktop, 320 px, 375 px, and 768 px viewports.

- 129 cases passed in the audit run.
- Three confirmed failures occurred for `/admin/stripe.html` at 320 px, 375 px, and 768 px.
- Failure: clicking `.menu-toggle` does not set `aria-expanded="true"`.
- Cause: the Stripe page loads `/admin/stripe.js` but not the shared `/site.js` navigation behaviour used by other admin pages.
- The full command reached the external audit timeout after executing all listed cases, so it must not be reported as a clean suite pass.

Generated test artifacts were removed after the failure was recorded.

## Risk register

### High

1. **Staging D1 is production D1.** Accidental staging writes can alter live data.
2. **Shared admin credential.** There is no per-user identity, least privilege, or reliable actor attribution.

### Medium

3. **Runtime schema creation.** `marketing_connections` is absent from numbered migrations.
4. **Stripe admin navigation defect.** Mobile/tablet menu controls do not initialise.
5. **Monolithic admin/public script.** Much admin behaviour lives in the large shared `public/site.js`, increasing regression surface.
6. **Unbounded external response buffering.** Avasam JSON parsing reads the entire upstream response as text; Cloudflare recommends streaming or bounding unknown-size responses.
7. **Duplicate marketing backup source.** `marketing.facebook-safe-backup.js` can drift and may confuse future maintenance, although it is not the active module.
8. **Incomplete configuration health metadata.** `secrets.required` does not cover all runtime dependencies.

### Low / design debt

9. Professional referral codes use `Math.random()`. They are checked for uniqueness, but they are predictable if they ever become authorization- or value-bearing identifiers.
10. Admin navigation and token-entry patterns are repeated across pages.
11. Status/error presentation is inconsistent between admin tools.

## Recommended Milestone 1 implementation

### Scope

1. Fix the Stripe admin shared navigation initialisation.
2. Add a consistent grouped admin navigation component/pattern across existing admin pages.
3. Refactor `/admin/` into a concise overview that links to, rather than duplicates, existing tools.
4. Populate overview cards using existing protected endpoints only.
5. Use explicit `Unavailable`, `Not connected`, and `No data yet` states.
6. Add tests for navigation, partial API failures, secret non-disclosure, keyboard behaviour, and responsive layout.

### Explicitly out of scope

- Amazon
- new AI features
- RBAC/admin accounts
- new database tables
- Cloudflare route or binding changes
- production/staging deployment
- changes to checkout, feed, marketing publishing, Instagram, Facebook, competitions, or public routes

### Likely files

- `public/admin/index.html`
- existing admin HTML pages for shared navigation markup
- `public/site.js` or a new narrowly scoped `public/admin/admin-shell.js`
- `public/styles.css` or a new narrowly scoped admin stylesheet
- `tests/page-loads.spec.ts`
- targeted Node tests only if API aggregation is introduced

No Worker file or migration should be necessary unless the approved design calls for a consolidated overview API.

### Acceptance gates

1. Approve information architecture and a simple wireframe before editing.
2. Implement on `feature/admin-control-centre`.
3. Keep commits focused and preserve legacy URLs.
4. Require all 106 unit tests, lint, type checks, dry-run bundle, and all 132 page tests to pass.
5. Review diff and screenshots before any push or deployment decision.

## Proposed implementation plan

1. Create the development branch after approval.
2. Fix and test the Stripe mobile navigation defect as an isolated commit.
3. Build the reusable admin shell/navigation without changing routes.
4. Apply it incrementally to existing admin pages.
5. Convert the main admin page into an overview using current APIs.
6. Add graceful partial-failure and accessibility coverage.
7. Run all validation and provide screenshots/diff.
8. Stop for review; do not push, merge, migrate, or deploy automatically.

## Audit completion statement

- No application code was edited.
- No secret values were read or exposed.
- No database data was modified.
- No migration was applied.
- No route, binding, Worker, database, or bucket was changed.
- No external post, email, checkout, or payment action was triggered.
- No production or staging deployment was performed.
