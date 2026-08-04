CREATE TABLE IF NOT EXISTS etsy_connections (
  id TEXT PRIMARY KEY,
  shop_id TEXT,
  shop_name TEXT,
  status TEXT NOT NULL DEFAULT 'Disconnected',
  access_token TEXT,
  refresh_token TEXT,
  token_type TEXT,
  token_expires_at TEXT,
  scope TEXT,
  oauth_state TEXT,
  pkce_verifier TEXT,
  last_successful_sync_at TEXT,
  last_attempted_sync_at TEXT,
  automatic_sync_enabled INTEGER NOT NULL DEFAULT 0,
  sync_interval_minutes INTEGER NOT NULL DEFAULT 360,
  last_error TEXT,
  connected_at TEXT,
  disconnected_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS etsy_products (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'etsy',
  external_listing_id TEXT NOT NULL,
  etsy_shop_id TEXT,
  title TEXT NOT NULL,
  display_title TEXT,
  description TEXT,
  display_description TEXT,
  price INTEGER,
  currency TEXT NOT NULL DEFAULT 'GBP',
  quantity INTEGER,
  availability TEXT,
  state TEXT,
  listing_url TEXT,
  primary_image TEXT,
  additional_images TEXT,
  tags TEXT,
  category TEXT,
  personalisation_available INTEGER NOT NULL DEFAULT 0,
  variations TEXT,
  created_time TEXT,
  updated_time TEXT,
  last_synced_at TEXT,
  admin_status TEXT NOT NULL DEFAULT 'review',
  public_visibility INTEGER NOT NULL DEFAULT 0,
  sync_error TEXT,
  raw_source_payload TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS etsy_products_source_external_idx ON etsy_products(source, external_listing_id);
CREATE INDEX IF NOT EXISTS etsy_products_review_idx ON etsy_products(admin_status, public_visibility);
CREATE INDEX IF NOT EXISTS etsy_products_shop_idx ON etsy_products(etsy_shop_id);

CREATE TABLE IF NOT EXISTS etsy_sync_runs (
  id TEXT PRIMARY KEY,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  attempted_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS etsy_sync_runs_started_idx ON etsy_sync_runs(started_at);

CREATE TABLE IF NOT EXISTS etsy_sync_errors (
  id TEXT PRIMARY KEY,
  sync_run_id TEXT NOT NULL,
  external_listing_id TEXT,
  error_message TEXT NOT NULL,
  raw_source_payload TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (sync_run_id) REFERENCES etsy_sync_runs(id)
);

CREATE INDEX IF NOT EXISTS etsy_sync_errors_run_idx ON etsy_sync_errors(sync_run_id);

CREATE TABLE IF NOT EXISTS site_pages (
  id TEXT PRIMARY KEY,
  page_name TEXT NOT NULL,
  route TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'live',
  included_in_navigation INTEGER NOT NULL DEFAULT 1,
  protected_page INTEGER NOT NULL DEFAULT 0,
  scheduled_publish_at TEXT,
  redirect_target TEXT,
  last_updated TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS site_pages_status_idx ON site_pages(status);

CREATE TABLE IF NOT EXISTS site_audit_events (
  id TEXT PRIMARY KEY,
  actor TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  previous_value TEXT,
  new_value TEXT,
  result TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS site_audit_events_created_idx ON site_audit_events(created_at);
CREATE INDEX IF NOT EXISTS site_audit_events_target_idx ON site_audit_events(target_type, target_id);

INSERT OR IGNORE INTO site_pages (id, page_name, route, status, included_in_navigation, protected_page, last_updated, created_at)
VALUES
  ('home', 'Home', '/', 'live', 1, 1, datetime('now'), datetime('now')),
  ('shop', 'Shop', '/shop', 'live', 1, 1, datetime('now'), datetime('now')),
  ('wash', 'Wash', '/wash', 'live', 1, 0, datetime('now'), datetime('now')),
  ('dog-walker-club', 'Dog Walker Club', '/dog-walker-club', 'live', 1, 0, datetime('now'), datetime('now')),
  ('find-a-professional', 'Find a Professional', '/find-a-professional', 'live', 1, 0, datetime('now'), datetime('now')),
  ('gift-cards', 'Gift Cards', '/gift-cards', 'live', 1, 0, datetime('now'), datetime('now')),
  ('about', 'About', '/about', 'live', 1, 0, datetime('now'), datetime('now')),
  ('contact', 'Contact', '/contact', 'live', 1, 1, datetime('now'), datetime('now')),
  ('faq', 'FAQ', '/faq', 'live', 1, 0, datetime('now'), datetime('now')),
  ('account', 'Account', '/account', 'live', 1, 1, datetime('now'), datetime('now')),
  ('cart', 'Cart', '/cart', 'live', 1, 1, datetime('now'), datetime('now'));
