CREATE TABLE IF NOT EXISTS avasam_catalogue_cache (
  sku TEXT PRIMARY KEY NOT NULL,
  public_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_pence INTEGER NOT NULL CHECK (price_pence > 0),
  supplier TEXT NOT NULL DEFAULT 'Avasam',
  status TEXT,
  availability TEXT,
  image TEXT,
  description TEXT,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_avasam_catalogue_cache_last_seen
  ON avasam_catalogue_cache(last_seen_at);
