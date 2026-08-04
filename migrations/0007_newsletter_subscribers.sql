CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'Subscribed',
  source TEXT NOT NULL DEFAULT 'Homepage',
  consent_text TEXT NOT NULL,
  subscribed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_email_idx
  ON newsletter_subscribers(email);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_status_idx
  ON newsletter_subscribers(status);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_subscribed_at_idx
  ON newsletter_subscribers(subscribed_at DESC);
