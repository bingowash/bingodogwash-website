ALTER TABLE tiktok_connections ADD COLUMN account_role TEXT NOT NULL DEFAULT 'creator';
ALTER TABLE tiktok_connections ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE tiktok_connections ADD COLUMN username TEXT NOT NULL DEFAULT '';

UPDATE tiktok_connections
SET id = 'creator', account_role = 'creator'
WHERE id = 'primary';

CREATE UNIQUE INDEX IF NOT EXISTS tiktok_connections_account_role_idx
ON tiktok_connections(account_role);
