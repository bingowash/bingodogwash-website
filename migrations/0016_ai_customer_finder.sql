CREATE TABLE IF NOT EXISTS prospects (
  id TEXT PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  subscriber_type TEXT NOT NULL DEFAULT 'unknown' CHECK (subscriber_type IN ('corporate','individual','unknown')),
  lia_basis_recorded INTEGER NOT NULL DEFAULT 0 CHECK (lia_basis_recorded IN (0,1)),
  consent_recorded INTEGER NOT NULL DEFAULT 0 CHECK (consent_recorded IN (0,1)),
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  compliance_status TEXT NOT NULL DEFAULT 'pending',
  last_contacted_at TEXT,
  converted_at TEXT,
  retention_expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prospect_sources (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_date TEXT NOT NULL,
  evidence TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(prospect_id, source, source_url),
  FOREIGN KEY (prospect_id) REFERENCES prospects(id)
);

CREATE TABLE IF NOT EXISTS prospect_product_matches (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_url TEXT NOT NULL,
  score INTEGER NOT NULL,
  reason TEXT NOT NULL,
  evidence TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(prospect_id, product_id),
  FOREIGN KEY (prospect_id) REFERENCES prospects(id)
);

CREATE TABLE IF NOT EXISTS outreach_messages (
  id TEXT PRIMARY KEY,
  prospect_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  compliance_status TEXT NOT NULL,
  approved_at TEXT,
  sent_at TEXT,
  provider TEXT NOT NULL DEFAULT 'brevo',
  provider_message_id TEXT,
  failure_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (prospect_id) REFERENCES prospects(id),
  FOREIGN KEY (match_id) REFERENCES prospect_product_matches(id)
);

CREATE TABLE IF NOT EXISTS outreach_runs (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL,
  prospects_found INTEGER NOT NULL DEFAULT 0,
  prospects_queued INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  search_api_cost REAL NOT NULL DEFAULT 0,
  cost_cap REAL NOT NULL DEFAULT 0,
  partial INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT '',
  started_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS suppression_list (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(email, domain)
);

CREATE TABLE IF NOT EXISTS outreach_message_events (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'brevo',
  provider_message_id TEXT NOT NULL DEFAULT '',
  raw_payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS prospects_status_idx ON prospects(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS prospects_retention_idx ON prospects(retention_expires_at);
CREATE INDEX IF NOT EXISTS outreach_messages_status_idx ON outreach_messages(status, created_at DESC);
CREATE INDEX IF NOT EXISTS outreach_runs_started_idx ON outreach_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS outreach_events_email_idx ON outreach_message_events(email, created_at DESC);
