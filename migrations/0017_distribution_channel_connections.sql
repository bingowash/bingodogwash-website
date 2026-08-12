CREATE TABLE IF NOT EXISTS distribution_channel_connections (
  channel TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'Disconnected',
  access_token TEXT NOT NULL DEFAULT '',
  refresh_token TEXT NOT NULL DEFAULT '',
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  token_expires_at TEXT NOT NULL DEFAULT '',
  scopes TEXT NOT NULL DEFAULT '',
  oauth_state TEXT NOT NULL DEFAULT '',
  oauth_state_expires_at TEXT NOT NULL DEFAULT '',
  connected_at TEXT NOT NULL DEFAULT '',
  disconnected_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
