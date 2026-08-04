CREATE TABLE IF NOT EXISTS wash_bookings (
  id TEXT PRIMARY KEY,
  booking_reference TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  telephone TEXT,
  dog_name TEXT,
  notes TEXT,
  preferred_time TEXT,
  amount INTEGER NOT NULL DEFAULT 1000,
  currency TEXT NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'Pending Stripe payment',
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_payment_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  expired_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_wash_bookings_created_at
  ON wash_bookings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wash_bookings_status
  ON wash_bookings(status);

CREATE INDEX IF NOT EXISTS idx_wash_bookings_stripe_session
  ON wash_bookings(stripe_checkout_session_id);
