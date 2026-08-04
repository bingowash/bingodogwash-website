# Etsy Integration Setup

The Etsy integration is deployed disabled by default.

## Feature Flags

Production and staging default to:

```text
ETSY_FEATURE_ENABLED=false
ETSY_SYNC_ENABLED=false
```

When `ETSY_FEATURE_ENABLED` is false:
- Etsy admin controls report the disabled state.
- Public `/api/etsy/products` returns an empty product list.
- No Etsy products appear in the public shop.

When `ETSY_SYNC_ENABLED` is false:
- Manual and scheduled syncs do not import listings.

## Secrets

Set these as Wrangler secrets before enabling Etsy:

```text
ETSY_API_KEY=
ETSY_API_SECRET=
ETSY_REDIRECT_URI=https://bingodogwash.com/api/etsy/callback
ETSY_SHOP_ID=
ETSY_SHOP_NAME=
ADMIN_API_TOKEN=
```

Do not commit real secret values.

## Enable Flow

1. Back up D1.
2. Apply migrations.
3. Deploy to staging.
4. Set `ETSY_FEATURE_ENABLED=true` in staging only.
5. Connect Etsy from the admin dashboard.
6. Set `ETSY_SYNC_ENABLED=true` in staging.
7. Run Sync now.
8. Confirm imported products are `review` and hidden from the public shop.
9. Approve and publish selected test products.
10. Confirm only published visible products appear in the public shop.
11. Repeat for production only after approval.

## Rollback

1. Set `ETSY_FEATURE_ENABLED=false` and `ETSY_SYNC_ENABLED=false`.
2. Deploy the previous Worker version with Wrangler rollback if needed.
3. Restore the D1 backup if product/page/admin data needs to be reverted.
4. Etsy products are isolated in `etsy_*` tables and do not overwrite existing Amazon, AppScenic, Avasam, cart, checkout, or manual product data.
