# Bingo Dog Wash Admin Control Centre — Safety-First Delivery Brief

## 1. Objective

Improve the existing Bingo Dog Wash administration experience without replacing working systems or inventing unavailable data.

The first delivery is an **audit and navigation/overview improvement**, not a wholesale platform rebuild. Amazon importing, AI drafting, role-based access control, and other new subsystems are separate optional projects with their own approval gates.

## 2. Non-negotiable safety rules

- Do not deploy, migrate production data, change production routes, or push Git changes unless the user explicitly approves that action after reviewing the relevant diff and test results.
- Do not delete or rename Workers, routes, bindings, databases, buckets, secrets, migrations, tables, columns, APIs, or established admin URLs.
- Do not overwrite unrelated working-tree changes. Inspect `git status`, ownership, and overlap before editing.
- Never stage the entire repository as a "backup". Create focused commits containing only reviewed files.
- Never print, read back, return, log, copy into documentation, or commit secret values.
- Treat external Cloudflare resources as unverified until confirmed through a read-only inventory. A resource name appearing in this brief is not permission to change it.
- Keep existing public shop, catalog/feed, Stripe checkout/webhooks, bookings, gift cards, competitions, professionals, newsletter, Etsy, Avasam, eBay, marketing, Facebook, and Instagram behaviour unchanged unless a separately approved task explicitly targets it.
- Keep production automation paused during any test that could publish externally.

## 3. Confirmed repository baseline

The audit must refresh this baseline before implementation, but the current repository already contains:

### Admin pages

- `/admin/` — consolidated admin entry point
- `/admin/competition.html`
- `/admin/gift-cards.html`
- `/admin/marketing.html`
- `/admin/professionals.html`
- `/admin/stripe.html` — protected Stripe and payments reporting

Existing URLs must remain valid. Navigation may link to them; it must not duplicate their functions.

### Primary Worker and storage

- Worker entry point: `_functions_NOT_FOR_STATIC_UPLOAD/api/worker.js`
- Marketing module: `_functions_NOT_FOR_STATIC_UPLOAD/api/marketing.js`
- Competition module: `_functions_NOT_FOR_STATIC_UPLOAD/api/competition.js`
- Production Worker name in this repository: `public`
- Primary D1 binding: `GIFT_CARD_DB`
- Primary D1 database: `bingo-gift-cards`
- Competition R2 bindings: `COMPETITION_PHOTOS` and legacy-compatible `bingo_competition_photos`
- Competition R2 bucket: `bingo-competition-photos`
- Static asset binding: `ASSETS`
- Workers AI binding: `AI`

Do not assume `ADMIN_DB`, `ADMIN_BUCKET`, `bingo-dog-wash-admin-data`, or `admin-assets` belong to this Worker. Verify them read-only in Cloudflare before mentioning them as implementation dependencies.

### Existing data migrations

The repository has additive migrations for gift cards, professionals, Etsy page management, wash bookings, giveaways, newsletters, competitions, sharing analytics, and marketing automation. Never edit an applied migration.

### Existing tests

- Node test suite: `npm test`
- Syntax checks: `npm run lint` and `npm run typecheck`
- Browser/page checks: Playwright configuration and `tests/page-loads.spec.ts`
- Cloudflare bundle validation: `npm run deploy:dry-run` (validation only; must not deploy)

## 4. Required workflow

### Gate A — Read-only audit

Before editing:

1. Refresh the Git remote and confirm branch divergence.
2. Record `git status` and preserve unrelated changes.
3. Inspect repository instructions and the full relevant source files.
4. Inventory current admin pages, navigation, protected APIs, authentication, database tables/migrations, storage bindings, external integrations, tests, and route ownership.
5. Run the existing unit tests and relevant static checks.
6. Where Cloudflare account access is available, perform read-only resource inventory only. Do not infer that every account resource is managed by this repository.
7. Identify duplicate proposals, missing data sources, and high-risk dependencies.

Deliver an audit report containing:

- confirmed current pages and APIs;
- confirmed Worker ownership and bindings;
- available data sources for dashboard metrics;
- authentication limitations;
- existing tests and baseline results;
- duplicate/already-built features;
- proposed files and exact scope;
- risks, unknowns, and decisions required.

Stop after the report unless implementation is explicitly approved.

### Gate B — Isolated branch

After approval and only with a clean or safely understood working tree:

```bash
git switch -c feature/admin-control-centre
```

Do not create a blanket "backup" commit. Existing uncommitted user work must either remain untouched or be committed separately with explicit approval.

### Gate C — Small implementation slices

Implement one independently testable slice at a time. Recommended order:

1. Navigation inventory and non-breaking information architecture.
2. Dashboard overview using existing APIs/data only.
3. Integration-health presentation using existing sanitized status endpoints.
4. Optional new features, each under a separate approved brief.

After each slice, run targeted tests and the full unit suite. Do not combine unrelated features in one commit.

## 5. Milestone 1 — Admin navigation and overview

### Navigation principles

- Link to existing pages rather than rebuilding them.
- Show only working destinations.
- Do not add empty pages merely to match an aspirational sitemap.
- Label unavailable future capabilities as proposals in documentation, not live navigation.
- Preserve every existing admin URL and bookmark.
- Prefer a small number of clear groups over deeply nested menus.

### Initial navigation structure

Use the following repository-backed structure:

```text
Overview
  Dashboard

Commerce
  Stripe & Payments
  Gift Cards
  Bookings (only if the existing dashboard/API supports a safe view)

Products & Website
  Existing product/page management
  Etsy management
  Feed status

Marketing
  Marketing Automation
  Newsletter (only through the existing protected API/UI)

Community
  Competitions
  Professionals
  Giveaway entries (only if an existing protected view is reusable)
```

Amazon, manual products, categories, reviews, memberships, affiliates, blog, SEO, media library, admin users, roles, and audit logs must not appear as working navigation until their underlying capability exists.

### Dashboard metrics

Use only confirmed existing data. Candidate cards include:

- pending/recent bookings;
- payment totals and webhook health from the existing protected Stripe reporting endpoint;
- gift-card totals;
- competition entries;
- professionals/applications;
- newsletter sign-ups;
- marketing schedule and latest post;
- Facebook and Instagram sanitized connection status;
- feed/integration health where an existing endpoint supplies it.

For unavailable or failed data, show one of:

- `Not connected`
- `Unavailable`
- `No data yet`

Do not convert missing values to zero unless zero is genuinely returned by the source.

### Milestone 1 acceptance criteria

- Existing admin URLs and actions still work.
- No new database migration is required unless separately approved.
- No production route or binding changes are required.
- Every displayed metric has a named existing source.
- Admin endpoints remain protected by existing authentication.
- No secret or sensitive payment data reaches browser responses.
- Unit, syntax, and relevant page-load tests pass.
- Accessibility includes keyboard navigation, visible focus, semantic headings, labelled controls, responsive layouts, and readable status text that does not rely on colour alone.

## 6. Authentication and security boundaries

The current system uses an existing admin-token model. Preserve it for Milestone 1.

- Validate authentication server-side using the existing constant-time comparison pattern.
- Never place the expected admin token in source code, HTML, URL parameters, storage migrations, logs, or API responses.
- Apply origin/CSRF protections appropriate to the actual authentication method and HTTP operation; do not add token-based CSRF machinery without a threat-model reason.
- Validate request methods, content types, sizes, identifiers, enums, URLs, and user-controlled strings.
- Escape browser-rendered data and avoid unsafe HTML interpolation.
- Return stable sanitized errors; log only sanitized operational context.
- Use idempotency/duplicate guards for state-changing operations where retries are possible.
- Do not claim role-based access control exists. Roles require a real user identity/session model and must be designed as a separate security project before implementation.
- Rate limiting must be implemented only with an appropriate durable/shared mechanism; in-memory Worker counters are not sufficient.

## 7. Database and Cloudflare change policy

If a later approved slice requires schema changes:

1. Inspect all existing migrations and production table shape read-only.
2. Add a new numbered migration; never modify old migrations.
3. Make it additive and backward-compatible.
4. Add tests for old and new data shapes where relevant.
5. Provide backup, apply, verification, and rollback/forward-fix instructions.
6. Do not run remote migration commands without explicit approval.

For Cloudflare configuration:

- Prefer existing bindings and routes.
- Do not add or change a route merely for UI convenience.
- Validate config with a dry run before proposing deployment.
- Do not modify or deploy staging until its bindings and data-isolation guarantees are confirmed.
- Do not deploy production without an explicit, separate approval after tests and diff review.

## 8. Optional project — Amazon affiliate products

Amazon importing is not part of Milestone 1. Start only after a separate discovery report confirms current Amazon UK API eligibility, terms, credentials, attribution rules, image/content caching restrictions, and Partner Tag.

If approved:

- use an Amazon-approved API; never scrape product pages;
- provide manual SiteStripe URL intake only if permitted by current Amazon terms;
- validate allowed Amazon hosts, ASIN, marketplace, and expected Partner Tag server-side;
- reject shortened or ambiguous URLs unless expanded and validated safely;
- keep affiliate products separate from direct Stripe checkout products;
- use `Buy on Amazon` and a clear affiliate disclosure;
- deduplicate by marketplace plus ASIN;
- preserve source URL, affiliate URL, local editorial fields, timestamps, and audit events;
- keep credentials server-side and never add placeholder secrets to Git.

API search must display `Not configured` until real credentials and a successful server-side health check exist.

## 9. Optional project — AI drafting assistant

AI drafting is not part of Milestone 1. If separately approved:

- generate drafts only; never publish automatically;
- require an explicit administrator approval action;
- preserve original content and revision history;
- label AI-generated fields and allow restore;
- use only public/product data necessary for the task;
- exclude customer, payment, authentication, secret, and private operational data;
- validate output length and render it as untrusted content;
- record model, timestamp, source product, approval state, and approving action without storing sensitive prompts.

## 10. Testing requirements

Every implementation slice must include appropriate tests for:

- authorised and unauthorised admin access;
- supported and unsupported HTTP methods;
- output escaping and secret non-disclosure;
- existing navigation and backward-compatible URLs;
- dashboard partial failures and unavailable integrations;
- existing booking, payment, competition, professional, marketing, and product behaviour touched by the slice;
- any additive D1 operations;
- responsive and accessible page loading.

Required verification before handover:

```bash
npm test
npm run lint
npm run typecheck
npm run deploy:dry-run
```

Run Playwright checks when the environment supports them. Report skipped checks and the exact blocker; do not call them passing.

## 11. Commit, push, deployment, and handover

- Use focused commits with descriptive messages.
- Do not merge into `main`, push, migrate, or deploy unless separately and explicitly requested.
- Before any push, fetch the remote and confirm the branch is not behind or unexpectedly diverged.
- Before deployment, provide the version diff, test evidence, configuration diff, migration plan, and rollback method.

Final handover must include:

1. Implemented scope and intentionally deferred scope.
2. Audit findings and architecture decisions.
3. Changed/new files.
4. Routes, bindings, variables, secrets, and migrations affected—or confirmation that none changed.
5. Tests and exact results.
6. Security and accessibility checks.
7. Known limitations.
8. Manual staging/production instructions, if requested.
9. Rollback or forward-fix plan.
10. Confirmation of whether any push, migration, route change, external post, or deployment occurred.

## 12. First-response requirement for an implementation agent

The first substantive response must be the Gate A audit report and a small implementation plan. Do not begin major edits merely because this brief was supplied. Ask for approval at the end of the audit when material product choices or new infrastructure are involved.
