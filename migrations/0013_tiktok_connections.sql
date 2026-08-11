CREATE TABLE IF NOT EXISTS tiktok_connections (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'Disconnected',
  open_id TEXT NOT NULL DEFAULT '',
  access_token TEXT NOT NULL DEFAULT '',
  refresh_token TEXT NOT NULL DEFAULT '',
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  access_token_expires_at TEXT NOT NULL DEFAULT '',
  refresh_token_expires_at TEXT NOT NULL DEFAULT '',
  scopes TEXT NOT NULL DEFAULT '',
  connected_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);
