PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS competitions (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  entry_fee INTEGER NOT NULL DEFAULT 500,
  prize_amount INTEGER NOT NULL DEFAULT 50000,
  max_photos INTEGER NOT NULL DEFAULT 3 CHECK (max_photos BETWEEN 1 AND 3),
  opens_at TEXT NOT NULL,
  closes_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','closed','archived')),
  voting_enabled INTEGER NOT NULL DEFAULT 0,
  rules TEXT NOT NULL,
  terms TEXT NOT NULL,
  winner_entry_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS competition_entries (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  entry_number INTEGER NOT NULL,
  public_slug TEXT NOT NULL UNIQUE,
  owner_name TEXT NOT NULL,
  owner_first_name TEXT NOT NULL,
  email TEXT NOT NULL,
  dog_name TEXT NOT NULL,
  breed TEXT NOT NULL,
  town TEXT NOT NULL,
  dog_age TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN ('awaiting_payment','pending','approved','rejected','withdrawn')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  amount INTEGER NOT NULL,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  vote_count INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  approved_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (competition_id, entry_number)
);

CREATE INDEX IF NOT EXISTS idx_competition_entries_public
  ON competition_entries(competition_id, status, vote_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_competition_entries_email
  ON competition_entries(competition_id, email);

CREATE TABLE IF NOT EXISTS competition_photos (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL REFERENCES competition_entries(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL CHECK (sort_order BETWEEN 1 AND 3),
  created_at TEXT NOT NULL,
  UNIQUE (entry_id, sort_order)
);

CREATE TABLE IF NOT EXISTS competition_votes (
  id TEXT PRIMARY KEY,
  competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL REFERENCES competition_entries(id) ON DELETE CASCADE,
  voter_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (competition_id, voter_hash)
);

CREATE TABLE IF NOT EXISTS competition_audit_log (
  id TEXT PRIMARY KEY,
  competition_id TEXT,
  entry_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO competitions (
  id, slug, name, description, entry_fee, prize_amount, max_photos,
  opens_at, closes_at, status, voting_enabled, rules, terms, created_at, updated_at
) VALUES (
  'top-dog-2026', 'top-dog-2026', 'Top Dog 2026',
  'Show us what makes your dog a Top Dog for the chance to win our £500 first prize.',
  500, 50000, 3, '2026-07-01T00:00:00.000Z', '2026-12-31T23:59:59.000Z',
  'open', 0,
  'Entrants must be 18 or over and resident in the UK. Each paid entry covers one dog and up to three original photos. Photos must be suitable for a family audience. The winner is selected under the published competition process. No purchase grants an advantage where public voting is disabled.',
  'By entering you confirm that you own or have permission to use the submitted photos, accept the competition rules, and permit Bingo Dog Wash to display the dog profile for the competition and Hall of Fame.',
  datetime('now'), datetime('now')
);
