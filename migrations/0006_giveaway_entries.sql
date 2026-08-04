CREATE TABLE IF NOT EXISTS giveaway_entries (
  entry_number INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  stripe_payment_id TEXT NOT NULL UNIQUE,
  stripe_checkout_session_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL DEFAULT 200 CHECK (amount = 200),
  currency TEXT NOT NULL DEFAULT 'GBP',
  payment_status TEXT NOT NULL DEFAULT 'Paid',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_giveaway_entries_created_at
  ON giveaway_entries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_giveaway_entries_email
  ON giveaway_entries(email);
