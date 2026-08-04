PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE IF NOT EXISTS "d1_migrations"(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_gift_cards.sql','2026-07-14 17:55:17');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(2,'0002_professional_network.sql','2026-07-15 15:27:31');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(3,'0003_amazon_affiliate_images.sql','2026-07-15 18:00:46');
INSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(4,'0003_professional_application_publication.sql','2026-07-16 14:43:12');
CREATE TABLE gift_cards (
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
CREATE TABLE gift_card_redemptions (
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
CREATE TABLE gift_card_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_event_id TEXT UNIQUE,
  gift_card_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE professional_applications (
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
, publication_status TEXT NOT NULL DEFAULT 'Unpublished', submitted_at TEXT, approved_at TEXT, business_town_city TEXT);
INSERT INTO "professional_applications" ("id","full_name","email","phone","business_name","business_postcode","professional_type","areas_covered","website","social_profile","years_experience","business_description","services_offered","insurance_status","dbs_status","privacy_consent","marketing_consent","privacy_policy_version","referred_by_code","status","admin_notes","created_at","updated_at","reviewed_at","reviewed_by","publication_status","submitted_at","approved_at","business_town_city") VALUES('d4733cbb-9a62-45c1-bd45-b8fda1d83b50','velma john','312vjohn@gmail.com','07940158418','steel working on it','N19 5DP','Dog walker','london','','','3','gjvhvkjvl','group','yes','check',1,1,'2026-07-15','','Approved','','2026-07-15T23:05:20.440Z','2026-07-16T17:47:27.129Z','2026-07-16T17:47:27.129Z','Bingo admin','Unpublished','2026-07-15T23:05:20.440Z','2026-07-16T17:47:27.129Z',NULL);
INSERT INTO "professional_applications" ("id","full_name","email","phone","business_name","business_postcode","professional_type","areas_covered","website","social_profile","years_experience","business_description","services_offered","insurance_status","dbs_status","privacy_consent","marketing_consent","privacy_policy_version","referred_by_code","status","admin_notes","created_at","updated_at","reviewed_at","reviewed_by","publication_status","submitted_at","approved_at","business_town_city") VALUES('3a50e83d-4cb0-49f6-b129-0d40b705373c','Charlie kelly','charliekelly214@yahoo.com','07743316892','Cleaning','ME15 7EX','Dog walker','Maidstone','','','10','','Walking','Insured','Pending',1,1,'2026-07-15','','Approved','','2026-07-16T10:45:07.410Z','2026-07-16T17:47:18.468Z','2026-07-16T17:47:18.468Z','Bingo admin','Unpublished','2026-07-16T10:45:07.410Z','2026-07-16T17:47:18.468Z',NULL);
INSERT INTO "professional_applications" ("id","full_name","email","phone","business_name","business_postcode","professional_type","areas_covered","website","social_profile","years_experience","business_description","services_offered","insurance_status","dbs_status","privacy_consent","marketing_consent","privacy_policy_version","referred_by_code","status","admin_notes","created_at","updated_at","reviewed_at","reviewed_by","publication_status","submitted_at","approved_at","business_town_city") VALUES('89c580ea-48ea-4ed1-b304-20d4705ae233','Serena-cleo','serena.john14@yahoo.com','7375138493','Serena walks','ME16 9BS','Dog walker','ME16 9BS','','','5 years','','Solo walks','Insured','DBS checked',1,1,'2026-07-15','','Approved','','2026-07-16T14:51:55.044Z','2026-07-16T17:47:10.410Z','2026-07-16T17:47:10.410Z','Bingo admin','Unpublished','2026-07-16T14:51:55.044Z','2026-07-16T17:47:10.410Z',NULL);
INSERT INTO "professional_applications" ("id","full_name","email","phone","business_name","business_postcode","professional_type","areas_covered","website","social_profile","years_experience","business_description","services_offered","insurance_status","dbs_status","privacy_consent","marketing_consent","privacy_policy_version","referred_by_code","status","admin_notes","created_at","updated_at","reviewed_at","reviewed_by","publication_status","submitted_at","approved_at","business_town_city") VALUES('7d5b6f0f-61b3-4d46-a177-ba480b15e838','Cic John','cicjohn62@gmail.com','07743316855','Dog walker','ME15 7EX','Dog walker','Maidstone','','','5','Bbxgdh','Solo walks','Insured','DBS checked',1,1,'2026-07-15','','Approved','','2026-07-16T14:52:03.301Z','2026-07-16T17:46:58.916Z','2026-07-16T17:46:58.916Z','Bingo admin','Unpublished','2026-07-16T14:52:03.301Z','2026-07-16T17:46:58.916Z',NULL);
CREATE TABLE professional_members (
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
INSERT INTO "professional_members" ("id","application_id","email","business_name","professional_type","status","founding_member","founding_position","founding_granted_at","founding_granted_by","referral_code","wash_credits","rewards_balance","lifetime_discount_percent","birthday_month","created_at","updated_at") VALUES('709c2f2a-ef67-46b3-bfb0-96f5a0980c45','7d5b6f0f-61b3-4d46-a177-ba480b15e838','cicjohn62@gmail.com','Dog walker','Dog walker','Active',1,1,'2026-07-16T17:46:59.062Z','Bingo admin','DOGWAL563',1,0,10,NULL,'2026-07-16T17:46:58.916Z','2026-07-16T17:46:59.062Z');
INSERT INTO "professional_members" ("id","application_id","email","business_name","professional_type","status","founding_member","founding_position","founding_granted_at","founding_granted_by","referral_code","wash_credits","rewards_balance","lifetime_discount_percent","birthday_month","created_at","updated_at") VALUES('96eef6cc-1e7f-485d-88af-59acdcc5e859','89c580ea-48ea-4ed1-b304-20d4705ae233','serena.john14@yahoo.com','Serena walks','Dog walker','Active',1,2,'2026-07-16T17:47:10.486Z','Bingo admin','SERENA446',1,0,10,NULL,'2026-07-16T17:47:10.410Z','2026-07-16T17:47:10.486Z');
INSERT INTO "professional_members" ("id","application_id","email","business_name","professional_type","status","founding_member","founding_position","founding_granted_at","founding_granted_by","referral_code","wash_credits","rewards_balance","lifetime_discount_percent","birthday_month","created_at","updated_at") VALUES('69593bd7-a40b-49ae-bc25-e3b5f1c2c8f2','3a50e83d-4cb0-49f6-b129-0d40b705373c','charliekelly214@yahoo.com','Cleaning','Dog walker','Active',1,3,'2026-07-16T17:47:18.551Z','Bingo admin','CLEANI423',1,0,10,NULL,'2026-07-16T17:47:18.468Z','2026-07-16T17:47:18.551Z');
INSERT INTO "professional_members" ("id","application_id","email","business_name","professional_type","status","founding_member","founding_position","founding_granted_at","founding_granted_by","referral_code","wash_credits","rewards_balance","lifetime_discount_percent","birthday_month","created_at","updated_at") VALUES('5d63c3c0-1d61-45fa-971b-4b9c0e88e097','d4733cbb-9a62-45c1-bd45-b8fda1d83b50','312vjohn@gmail.com','steel working on it','Dog walker','Active',1,4,'2026-07-16T17:47:27.214Z','Bingo admin','STEELW137',1,0,10,NULL,'2026-07-16T17:47:27.129Z','2026-07-16T17:47:27.214Z');
CREATE TABLE professional_profiles (
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
INSERT INTO "professional_profiles" ("id","member_id","slug","business_name","professional_name","professional_type","general_location","description","services_offered","areas_covered","years_experience","website","social_profile","insurance_status","dbs_status","availability","logo_url","publication_status","founding_member","created_at","updated_at","published_at") VALUES('43dc08d7-4ae6-477e-a026-6d81330ca598','709c2f2a-ef67-46b3-bfb0-96f5a0980c45','dog-walker','Dog walker','Cic John','Dog walker','ME15 7EX','Bbxgdh','Solo walks','Maidstone','5','','','Insured','DBS checked','Contact for availability',NULL,'Unpublished',1,'2026-07-16T17:46:58.916Z','2026-07-16T17:46:59.062Z','');
INSERT INTO "professional_profiles" ("id","member_id","slug","business_name","professional_name","professional_type","general_location","description","services_offered","areas_covered","years_experience","website","social_profile","insurance_status","dbs_status","availability","logo_url","publication_status","founding_member","created_at","updated_at","published_at") VALUES('75e9139d-9387-4414-8c32-35653a9476f5','96eef6cc-1e7f-485d-88af-59acdcc5e859','serena-walks','Serena walks','Serena-cleo','Dog walker','ME16 9BS','','Solo walks','ME16 9BS','5 years','','','Insured','DBS checked','Contact for availability',NULL,'Unpublished',1,'2026-07-16T17:47:10.410Z','2026-07-16T17:47:10.486Z','');
INSERT INTO "professional_profiles" ("id","member_id","slug","business_name","professional_name","professional_type","general_location","description","services_offered","areas_covered","years_experience","website","social_profile","insurance_status","dbs_status","availability","logo_url","publication_status","founding_member","created_at","updated_at","published_at") VALUES('7d024785-ccf3-4074-9bfe-a6240b89f28c','69593bd7-a40b-49ae-bc25-e3b5f1c2c8f2','cleaning','Cleaning','Charlie kelly','Dog walker','ME15 7EX','','Walking','Maidstone','10','','','Insured','Pending','Contact for availability',NULL,'Unpublished',1,'2026-07-16T17:47:18.468Z','2026-07-16T17:47:18.551Z','');
INSERT INTO "professional_profiles" ("id","member_id","slug","business_name","professional_name","professional_type","general_location","description","services_offered","areas_covered","years_experience","website","social_profile","insurance_status","dbs_status","availability","logo_url","publication_status","founding_member","created_at","updated_at","published_at") VALUES('71985ca7-0491-452c-ae4b-eb16550127a6','5d63c3c0-1d61-45fa-971b-4b9c0e88e097','steel-working-on-it','steel working on it','velma john','Dog walker','N19 5DP','gjvhvkjvl','group','london','3','','','yes','check','Contact for availability',NULL,'Unpublished',1,'2026-07-16T17:47:27.129Z','2026-07-16T17:47:27.214Z','');
CREATE TABLE professional_enquiries (
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
CREATE TABLE professional_rewards (
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
INSERT INTO "professional_rewards" ("id","member_id","reward_type","value","description","created_at","expiry_date","redeemed_at","status","source","created_by") VALUES('237721d3-2fca-4c30-98e3-dceefdb5f58b','709c2f2a-ef67-46b3-bfb0-96f5a0980c45','Welcome credit',1,'Welcome wash credit for approved professional member.','2026-07-16T17:46:58.916Z',NULL,NULL,'Active','System','Bingo admin');
INSERT INTO "professional_rewards" ("id","member_id","reward_type","value","description","created_at","expiry_date","redeemed_at","status","source","created_by") VALUES('1edf6ce5-1103-4d3d-abd2-93e985ad1672','96eef6cc-1e7f-485d-88af-59acdcc5e859','Welcome credit',1,'Welcome wash credit for approved professional member.','2026-07-16T17:47:10.410Z',NULL,NULL,'Active','System','Bingo admin');
INSERT INTO "professional_rewards" ("id","member_id","reward_type","value","description","created_at","expiry_date","redeemed_at","status","source","created_by") VALUES('c3826c6e-9523-40b1-8b25-e069cced37a2','69593bd7-a40b-49ae-bc25-e3b5f1c2c8f2','Welcome credit',1,'Welcome wash credit for approved professional member.','2026-07-16T17:47:18.468Z',NULL,NULL,'Active','System','Bingo admin');
INSERT INTO "professional_rewards" ("id","member_id","reward_type","value","description","created_at","expiry_date","redeemed_at","status","source","created_by") VALUES('876f522f-a257-4704-968c-3c05d1a5d784','5d63c3c0-1d61-45fa-971b-4b9c0e88e097','Welcome credit',1,'Welcome wash credit for approved professional member.','2026-07-16T17:47:27.129Z',NULL,NULL,'Active','System','Bingo admin');
CREATE TABLE professional_referrals (
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
CREATE TABLE professional_audit_events (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO "professional_audit_events" ("id","entity_type","entity_id","event_type","actor","detail","created_at") VALUES('141652b1-72c9-4fd3-b370-04dc2c78fd94','application','d4733cbb-9a62-45c1-bd45-b8fda1d83b50','created','public','Professional application submitted.','2026-07-15T23:05:20.583Z');
INSERT INTO "professional_audit_events" ("id","entity_type","entity_id","event_type","actor","detail","created_at") VALUES('9a322364-8eb4-4f42-97c5-b5a1d02c4b38','application','3a50e83d-4cb0-49f6-b129-0d40b705373c','created','public','Professional application submitted.','2026-07-16T10:45:07.558Z');
INSERT INTO "professional_audit_events" ("id","entity_type","entity_id","event_type","actor","detail","created_at") VALUES('fd4aa99b-a93e-4997-bd24-16493a7e9ae5','application','89c580ea-48ea-4ed1-b304-20d4705ae233','created','public','Professional application submitted.','2026-07-16T14:51:55.070Z');
INSERT INTO "professional_audit_events" ("id","entity_type","entity_id","event_type","actor","detail","created_at") VALUES('54a3f62c-e6f4-474d-a5fe-2985b7753e18','application','7d5b6f0f-61b3-4d46-a177-ba480b15e838','created','public','Professional application submitted.','2026-07-16T14:52:03.324Z');
INSERT INTO "professional_audit_events" ("id","entity_type","entity_id","event_type","actor","detail","created_at") VALUES('af133a1b-b8d2-425f-9660-0a3751a19230','member','709c2f2a-ef67-46b3-bfb0-96f5a0980c45','founding-slot-granted','Bingo admin','Founding slot 1 granted.','2026-07-16T17:46:59.141Z');
INSERT INTO "professional_audit_events" ("id","entity_type","entity_id","event_type","actor","detail","created_at") VALUES('8e655ea5-c6b3-416f-bdb2-3280a355fc70','application','7d5b6f0f-61b3-4d46-a177-ba480b15e838','approved','Bingo admin','Application approved and member profile created.','2026-07-16T17:46:59.173Z');
INSERT INTO "professional_audit_events" ("id","entity_type","entity_id","event_type","actor","detail","created_at") VALUES('da61ccea-32ae-4e77-bf6b-ea6a1c16e56f','member','96eef6cc-1e7f-485d-88af-59acdcc5e859','founding-slot-granted','Bingo admin','Founding slot 2 granted.','2026-07-16T17:47:10.543Z');
INSERT INTO "professional_audit_events" ("id","entity_type","entity_id","event_type","actor","detail","created_at") VALUES('6d9092b0-4cc8-41b1-89fe-908773458dc1','application','89c580ea-48ea-4ed1-b304-20d4705ae233','approved','Bingo admin','Application approved and member profile created.','2026-07-16T17:47:10.571Z');
INSERT INTO "professional_audit_events" ("id","entity_type","entity_id","event_type","actor","detail","created_at") VALUES('13dd3c17-56d8-4a16-a4cd-8327be1e4ece','member','69593bd7-a40b-49ae-bc25-e3b5f1c2c8f2','founding-slot-granted','Bingo admin','Founding slot 3 granted.','2026-07-16T17:47:18.613Z');
INSERT INTO "professional_audit_events" ("id","entity_type","entity_id","event_type","actor","detail","created_at") VALUES('c37a709f-b24d-4b7b-9110-bff20c163128','application','3a50e83d-4cb0-49f6-b129-0d40b705373c','approved','Bingo admin','Application approved and member profile created.','2026-07-16T17:47:18.643Z');
INSERT INTO "professional_audit_events" ("id","entity_type","entity_id","event_type","actor","detail","created_at") VALUES('f3e36008-6b0d-46bf-a057-00e2c174ecbb','member','5d63c3c0-1d61-45fa-971b-4b9c0e88e097','founding-slot-granted','Bingo admin','Founding slot 4 granted.','2026-07-16T17:47:27.266Z');
INSERT INTO "professional_audit_events" ("id","entity_type","entity_id","event_type","actor","detail","created_at") VALUES('53a426c8-4b70-4e31-b945-0b49b3517048','application','d4733cbb-9a62-45c1-bd45-b8fda1d83b50','approved','Bingo admin','Application approved and member profile created.','2026-07-16T17:47:27.300Z');
CREATE TABLE professional_founding_slots (
  slot INTEGER PRIMARY KEY,
  member_id TEXT NOT NULL UNIQUE,
  granted_at TEXT NOT NULL,
  granted_by TEXT,
  FOREIGN KEY (member_id) REFERENCES professional_members(id)
);
INSERT INTO "professional_founding_slots" ("slot","member_id","granted_at","granted_by") VALUES(1,'709c2f2a-ef67-46b3-bfb0-96f5a0980c45','2026-07-16T17:46:59.062Z','Bingo admin');
INSERT INTO "professional_founding_slots" ("slot","member_id","granted_at","granted_by") VALUES(2,'96eef6cc-1e7f-485d-88af-59acdcc5e859','2026-07-16T17:47:10.486Z','Bingo admin');
INSERT INTO "professional_founding_slots" ("slot","member_id","granted_at","granted_by") VALUES(3,'69593bd7-a40b-49ae-bc25-e3b5f1c2c8f2','2026-07-16T17:47:18.551Z','Bingo admin');
INSERT INTO "professional_founding_slots" ("slot","member_id","granted_at","granted_by") VALUES(4,'5d63c3c0-1d61-45fa-971b-4b9c0e88e097','2026-07-16T17:47:27.214Z','Bingo admin');
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',4);
CREATE UNIQUE INDEX gift_cards_code_idx ON gift_cards(code);
CREATE INDEX gift_cards_recipient_email_idx ON gift_cards(recipient_email);
CREATE INDEX gift_cards_buyer_email_idx ON gift_cards(buyer_email);
CREATE INDEX gift_cards_status_idx ON gift_cards(status);
CREATE INDEX gift_cards_purchase_date_idx ON gift_cards(purchase_date);
CREATE INDEX gift_cards_session_idx ON gift_cards(stripe_checkout_session_id);
CREATE INDEX gift_card_redemptions_card_idx ON gift_card_redemptions(gift_card_id);
CREATE INDEX gift_card_redemptions_redeemed_at_idx ON gift_card_redemptions(redeemed_at);
CREATE INDEX gift_card_events_card_idx ON gift_card_events(gift_card_id);
CREATE UNIQUE INDEX professional_applications_email_idx ON professional_applications(email);
CREATE INDEX professional_applications_status_idx ON professional_applications(status);
CREATE INDEX professional_applications_postcode_idx ON professional_applications(business_postcode);
CREATE INDEX professional_applications_type_idx ON professional_applications(professional_type);
CREATE INDEX professional_members_status_idx ON professional_members(status);
CREATE INDEX professional_members_type_idx ON professional_members(professional_type);
CREATE INDEX professional_members_founding_idx ON professional_members(founding_member);
CREATE INDEX professional_profiles_public_idx ON professional_profiles(publication_status, professional_type);
CREATE INDEX professional_profiles_location_idx ON professional_profiles(general_location);
CREATE INDEX professional_enquiries_member_idx ON professional_enquiries(member_id);
CREATE INDEX professional_enquiries_status_idx ON professional_enquiries(status);
CREATE INDEX professional_enquiries_created_idx ON professional_enquiries(created_at);
CREATE INDEX professional_rewards_member_idx ON professional_rewards(member_id);
CREATE INDEX professional_rewards_status_idx ON professional_rewards(status);
CREATE INDEX professional_referrals_code_idx ON professional_referrals(referral_code);
CREATE INDEX professional_referrals_member_idx ON professional_referrals(referring_member_id);
CREATE INDEX professional_audit_entity_idx ON professional_audit_events(entity_type, entity_id);
CREATE INDEX professional_audit_created_idx ON professional_audit_events(created_at);
CREATE INDEX professional_applications_publication_idx ON professional_applications(publication_status);
