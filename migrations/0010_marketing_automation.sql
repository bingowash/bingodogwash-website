CREATE TABLE IF NOT EXISTS marketing_settings (
  id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  schedule_hour_utc INTEGER NOT NULL DEFAULT 9,
  schedule_minute_utc INTEGER NOT NULL DEFAULT 0,
  last_run_date TEXT,
  next_run_at TEXT,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO marketing_settings
  (id, enabled, schedule_hour_utc, schedule_minute_utc, last_run_date, next_run_at, updated_at)
VALUES ('primary', 0, 9, 0, '', '', datetime('now'));

CREATE TABLE IF NOT EXISTS marketing_posts (
  id TEXT PRIMARY KEY,
  product_source TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_url TEXT NOT NULL,
  product_image TEXT,
  caption TEXT NOT NULL,
  campaign_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  facebook_post_id TEXT,
  instagram_post_id TEXT,
  error_message TEXT,
  scheduled_at TEXT,
  posted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS marketing_posts_product_idx ON marketing_posts(product_source, product_id, created_at);
CREATE INDEX IF NOT EXISTS marketing_posts_created_idx ON marketing_posts(created_at);
CREATE INDEX IF NOT EXISTS marketing_posts_status_idx ON marketing_posts(status, created_at);

CREATE TABLE IF NOT EXISTS marketing_platform_results (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL,
  external_post_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES marketing_posts(id)
);

CREATE INDEX IF NOT EXISTS marketing_platform_post_idx ON marketing_platform_results(post_id, platform);

CREATE TABLE IF NOT EXISTS marketing_events (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  campaign_code TEXT,
  event_type TEXT NOT NULL,
  platform TEXT,
  value INTEGER NOT NULL DEFAULT 1,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS marketing_events_campaign_idx ON marketing_events(campaign_code, event_type, created_at);
CREATE INDEX IF NOT EXISTS marketing_events_post_idx ON marketing_events(post_id, event_type, created_at);
