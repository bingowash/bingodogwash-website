CREATE TABLE IF NOT EXISTS marketing_connections (
  id TEXT PRIMARY KEY,
  page_access_token TEXT,
  page_token_expires_at TEXT,
  instagram_access_token TEXT,
  instagram_token_expires_at TEXT,
  updated_at TEXT
);
