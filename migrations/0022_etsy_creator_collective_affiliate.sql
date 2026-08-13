ALTER TABLE etsy_products ADD COLUMN original_listing_url TEXT;
ALTER TABLE etsy_products ADD COLUMN affiliate_url TEXT;
ALTER TABLE etsy_products ADD COLUMN affiliate_provider TEXT;
ALTER TABLE etsy_products ADD COLUMN affiliate_program TEXT;
ALTER TABLE etsy_products ADD COLUMN affiliate_storefront TEXT;
ALTER TABLE etsy_products ADD COLUMN affiliate_provenance TEXT;
ALTER TABLE etsy_products ADD COLUMN commission_disclosure TEXT;
ALTER TABLE etsy_products ADD COLUMN affiliate_review_status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE etsy_products ADD COLUMN affiliate_reviewed_at TEXT;
ALTER TABLE etsy_products ADD COLUMN affiliate_reviewed_by TEXT;

CREATE INDEX IF NOT EXISTS etsy_products_affiliate_review_idx
  ON etsy_products(affiliate_review_status);
