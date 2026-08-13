ALTER TABLE etsy_products ADD COLUMN affiliate_verification_status TEXT NOT NULL DEFAULT 'unverified';
ALTER TABLE etsy_products ADD COLUMN affiliate_verified_url TEXT;
ALTER TABLE etsy_products ADD COLUMN affiliate_final_url TEXT;
ALTER TABLE etsy_products ADD COLUMN affiliate_destination_listing_id TEXT;
ALTER TABLE etsy_products ADD COLUMN affiliate_verified_at TEXT;

CREATE INDEX IF NOT EXISTS etsy_products_affiliate_verification_idx
  ON etsy_products(affiliate_verification_status);
