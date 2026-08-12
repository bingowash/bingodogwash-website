ALTER TABLE prospects ADD COLUMN google_place_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS prospects_google_place_id_unique
ON prospects(google_place_id)
WHERE google_place_id IS NOT NULL AND trim(google_place_id) <> '';

ALTER TABLE outreach_runs ADD COLUMN google_searches_attempted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outreach_runs ADD COLUMN google_searches_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outreach_runs ADD COLUMN google_duplicates_rejected INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outreach_runs ADD COLUMN google_invalid_rejected INTEGER NOT NULL DEFAULT 0;
