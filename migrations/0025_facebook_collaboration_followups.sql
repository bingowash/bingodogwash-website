CREATE TABLE IF NOT EXISTS marketing_facebook_collaboration_followups (
  platform_result_id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  collaboration_state TEXT NOT NULL CHECK (collaboration_state IN ('pending', 'completed')),
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (platform_result_id) REFERENCES marketing_platform_results(id),
  FOREIGN KEY (post_id) REFERENCES marketing_posts(id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_facebook_collaboration_post
  ON marketing_facebook_collaboration_followups(post_id, updated_at DESC);
