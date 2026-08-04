CREATE TABLE IF NOT EXISTS professional_applications (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  business_name TEXT NOT NULL,
  business_postcode TEXT NOT NULL,
  professional_type TEXT NOT NULL DEFAULT 'Dog walker',
  areas_covered TEXT,
  website TEXT,
  social_profile TEXT,
  years_experience TEXT,
  business_description TEXT,
  services_offered TEXT,
  insurance_status TEXT,
  dbs_status TEXT,
  privacy_consent INTEGER NOT NULL DEFAULT 0,
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  privacy_policy_version TEXT,
  referred_by_code TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  admin_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS professional_applications_email_idx ON professional_applications(email);
CREATE INDEX IF NOT EXISTS professional_applications_status_idx ON professional_applications(status);
CREATE INDEX IF NOT EXISTS professional_applications_postcode_idx ON professional_applications(business_postcode);
CREATE INDEX IF NOT EXISTS professional_applications_type_idx ON professional_applications(professional_type);

CREATE TABLE IF NOT EXISTS professional_members (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  professional_type TEXT NOT NULL DEFAULT 'Dog walker',
  status TEXT NOT NULL DEFAULT 'Active',
  founding_member INTEGER NOT NULL DEFAULT 0,
  founding_position INTEGER UNIQUE,
  founding_granted_at TEXT,
  founding_granted_by TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  wash_credits INTEGER NOT NULL DEFAULT 0,
  rewards_balance INTEGER NOT NULL DEFAULT 0,
  lifetime_discount_percent INTEGER NOT NULL DEFAULT 0,
  birthday_month TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (application_id) REFERENCES professional_applications(id)
);

CREATE INDEX IF NOT EXISTS professional_members_status_idx ON professional_members(status);
CREATE INDEX IF NOT EXISTS professional_members_type_idx ON professional_members(professional_type);
CREATE INDEX IF NOT EXISTS professional_members_founding_idx ON professional_members(founding_member);

CREATE TABLE IF NOT EXISTS professional_profiles (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  professional_name TEXT,
  professional_type TEXT NOT NULL DEFAULT 'Dog walker',
  general_location TEXT,
  description TEXT,
  services_offered TEXT,
  areas_covered TEXT,
  years_experience TEXT,
  website TEXT,
  social_profile TEXT,
  insurance_status TEXT,
  dbs_status TEXT,
  availability TEXT,
  logo_url TEXT,
  publication_status TEXT NOT NULL DEFAULT 'Draft',
  founding_member INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  FOREIGN KEY (member_id) REFERENCES professional_members(id)
);

CREATE INDEX IF NOT EXISTS professional_profiles_public_idx ON professional_profiles(publication_status, professional_type);
CREATE INDEX IF NOT EXISTS professional_profiles_location_idx ON professional_profiles(general_location);

CREATE TABLE IF NOT EXISTS professional_enquiries (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  postcode TEXT,
  dog_details TEXT,
  service_required TEXT,
  preferred_dates TEXT,
  message TEXT,
  share_consent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'New',
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  FOREIGN KEY (profile_id) REFERENCES professional_profiles(id),
  FOREIGN KEY (member_id) REFERENCES professional_members(id)
);

CREATE INDEX IF NOT EXISTS professional_enquiries_member_idx ON professional_enquiries(member_id);
CREATE INDEX IF NOT EXISTS professional_enquiries_status_idx ON professional_enquiries(status);
CREATE INDEX IF NOT EXISTS professional_enquiries_created_idx ON professional_enquiries(created_at);

CREATE TABLE IF NOT EXISTS professional_rewards (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TEXT NOT NULL,
  expiry_date TEXT,
  redeemed_at TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  source TEXT NOT NULL DEFAULT 'System',
  created_by TEXT,
  FOREIGN KEY (member_id) REFERENCES professional_members(id)
);

CREATE INDEX IF NOT EXISTS professional_rewards_member_idx ON professional_rewards(member_id);
CREATE INDEX IF NOT EXISTS professional_rewards_status_idx ON professional_rewards(status);

CREATE TABLE IF NOT EXISTS professional_referrals (
  id TEXT PRIMARY KEY,
  referring_member_id TEXT,
  referral_code TEXT NOT NULL,
  referred_application_id TEXT,
  referred_email TEXT,
  application_date TEXT NOT NULL,
  application_status TEXT NOT NULL DEFAULT 'Pending',
  approval_date TEXT,
  reward_status TEXT NOT NULL DEFAULT 'Pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (referring_member_id) REFERENCES professional_members(id),
  FOREIGN KEY (referred_application_id) REFERENCES professional_applications(id)
);

CREATE INDEX IF NOT EXISTS professional_referrals_code_idx ON professional_referrals(referral_code);
CREATE INDEX IF NOT EXISTS professional_referrals_member_idx ON professional_referrals(referring_member_id);

CREATE TABLE IF NOT EXISTS professional_audit_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS professional_audit_entity_idx ON professional_audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS professional_audit_created_idx ON professional_audit_events(created_at);

CREATE TABLE IF NOT EXISTS professional_founding_slots (
  slot INTEGER PRIMARY KEY,
  member_id TEXT NOT NULL UNIQUE,
  granted_at TEXT NOT NULL,
  granted_by TEXT,
  FOREIGN KEY (member_id) REFERENCES professional_members(id)
);
