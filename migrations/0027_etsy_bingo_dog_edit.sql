-- Etsy / Bingo Dog Edit curation metadata. Existing marketplace-imported rows
-- intentionally remain unprovenanced and cannot enter the curated public edit.
ALTER TABLE etsy_products ADD COLUMN etsy_feed_provenance TEXT NOT NULL DEFAULT '';
ALTER TABLE etsy_products ADD COLUMN etsy_shop_section_id TEXT;
ALTER TABLE etsy_products ADD COLUMN etsy_shop_section_name TEXT;
ALTER TABLE etsy_products ADD COLUMN bingo_collection TEXT;
ALTER TABLE etsy_products ADD COLUMN bingo_slot INTEGER;

CREATE INDEX IF NOT EXISTS etsy_products_bingo_edit_idx
  ON etsy_products(etsy_feed_provenance, bingo_collection, admin_status, public_visibility, bingo_slot);
