CREATE TABLE IF NOT EXISTS gift_cards (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  original_amount INTEGER NOT NULL,
  remaining_balance INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'Active',
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  message TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  purchase_date TEXT NOT NULL,
  delivery_date TEXT,
  delivered_at TEXT,
  stripe_checkout_session_id TEXT NOT NULL,
  stripe_payment_intent_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS gift_cards_code_idx ON gift_cards(code);
CREATE INDEX IF NOT EXISTS gift_cards_recipient_email_idx ON gift_cards(recipient_email);
CREATE INDEX IF NOT EXISTS gift_cards_buyer_email_idx ON gift_cards(buyer_email);
CREATE INDEX IF NOT EXISTS gift_cards_status_idx ON gift_cards(status);
CREATE INDEX IF NOT EXISTS gift_cards_purchase_date_idx ON gift_cards(purchase_date);
CREATE INDEX IF NOT EXISTS gift_cards_session_idx ON gift_cards(stripe_checkout_session_id);

CREATE TABLE IF NOT EXISTS gift_card_redemptions (
  id TEXT PRIMARY KEY,
  gift_card_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  previous_balance INTEGER NOT NULL,
  new_balance INTEGER NOT NULL,
  reference TEXT,
  redeemed_by TEXT,
  redeemed_at TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id)
);

CREATE INDEX IF NOT EXISTS gift_card_redemptions_card_idx ON gift_card_redemptions(gift_card_id);
CREATE INDEX IF NOT EXISTS gift_card_redemptions_redeemed_at_idx ON gift_card_redemptions(redeemed_at);

CREATE TABLE IF NOT EXISTS gift_card_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT UNIQUE,
  gift_card_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS gift_card_events_card_idx ON gift_card_events(gift_card_id);
