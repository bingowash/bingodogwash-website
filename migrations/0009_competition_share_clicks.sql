PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS competition_share_clicks (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL REFERENCES competition_entries(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook','whatsapp','x','instagram','native')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_competition_share_clicks_reporting
  ON competition_share_clicks(competition_id, platform, created_at DESC);
