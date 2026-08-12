ALTER TABLE outreach_runs ADD COLUMN raw_results INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outreach_runs ADD COLUMN normalized_results INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outreach_runs ADD COLUMN rejected_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outreach_runs ADD COLUMN qualified_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outreach_runs ADD COLUMN provider_errors TEXT NOT NULL DEFAULT '[]';

CREATE UNIQUE INDEX IF NOT EXISTS outreach_runs_one_manual_running
ON outreach_runs(trigger_type)
WHERE trigger_type = 'manual' AND status = 'running';
