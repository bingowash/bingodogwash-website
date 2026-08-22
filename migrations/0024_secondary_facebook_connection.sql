CREATE TABLE IF NOT EXISTS marketing_facebook_connections (
  role TEXT PRIMARY KEY CHECK (role = 'facebook_secondary'),
  page_id TEXT NOT NULL UNIQUE,
  page_name TEXT NOT NULL,
  page_access_token TEXT NOT NULL,
  token_expires_at TEXT,
  token_type TEXT NOT NULL DEFAULT 'PAGE',
  tasks TEXT NOT NULL DEFAULT '[]',
  latest_health_status TEXT NOT NULL DEFAULT 'unknown',
  latest_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS marketing_facebook_oauth_pages (
  flow_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  page_name TEXT NOT NULL,
  page_access_token TEXT NOT NULL,
  tasks TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (flow_id, page_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_facebook_oauth_pages_expiry
  ON marketing_facebook_oauth_pages (expires_at);
