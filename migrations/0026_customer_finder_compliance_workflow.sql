-- Additive Customer Finder PECR and LIA evidence model.
ALTER TABLE prospects ADD COLUMN subscriber_type_evidence TEXT NOT NULL DEFAULT '';
ALTER TABLE prospects ADD COLUMN consent_evidence TEXT NOT NULL DEFAULT '';
ALTER TABLE prospects ADD COLUMN soft_opt_in_recorded INTEGER NOT NULL DEFAULT 0 CHECK (soft_opt_in_recorded IN (0,1));
ALTER TABLE prospects ADD COLUMN soft_opt_in_evidence TEXT NOT NULL DEFAULT '';
ALTER TABLE prospects ADD COLUMN lia_status TEXT NOT NULL DEFAULT 'not_recorded' CHECK (lia_status IN ('not_recorded','legacy_recorded','passed','failed'));
ALTER TABLE prospects ADD COLUMN lia_purpose_test TEXT NOT NULL DEFAULT '';
ALTER TABLE prospects ADD COLUMN lia_necessity_test TEXT NOT NULL DEFAULT '';
ALTER TABLE prospects ADD COLUMN lia_balancing_test TEXT NOT NULL DEFAULT '';
ALTER TABLE prospects ADD COLUMN lia_assessed_at TEXT;
ALTER TABLE prospects ADD COLUMN lia_evidence_source TEXT NOT NULL DEFAULT '';
ALTER TABLE prospects ADD COLUMN lia_subscriber_type TEXT NOT NULL DEFAULT '';
ALTER TABLE prospects ADD COLUMN lia_subscriber_evidence TEXT NOT NULL DEFAULT '';
ALTER TABLE prospects ADD COLUMN lia_reviewer_reference TEXT NOT NULL DEFAULT '';
ALTER TABLE prospects ADD COLUMN lia_opt_out_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (lia_opt_out_confirmed IN (0,1));
ALTER TABLE prospects ADD COLUMN lia_suppression_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (lia_suppression_confirmed IN (0,1));

-- Preserve prior boolean history without treating it as a new three-part LIA.
UPDATE prospects SET lia_status='legacy_recorded' WHERE lia_basis_recorded=1;
