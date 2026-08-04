ALTER TABLE professional_applications ADD COLUMN publication_status TEXT NOT NULL DEFAULT 'Unpublished';
ALTER TABLE professional_applications ADD COLUMN submitted_at TEXT;
ALTER TABLE professional_applications ADD COLUMN approved_at TEXT;
ALTER TABLE professional_applications ADD COLUMN business_town_city TEXT;

UPDATE professional_applications
SET submitted_at = COALESCE(submitted_at, created_at),
    publication_status = COALESCE(publication_status, 'Unpublished');

UPDATE professional_applications
SET approved_at = COALESCE(approved_at, reviewed_at)
WHERE status = 'Approved';

UPDATE professional_applications
SET publication_status = 'Published'
WHERE id IN (
  SELECT m.application_id
  FROM professional_members m
  JOIN professional_profiles p ON p.member_id = m.id
  WHERE p.publication_status = 'Published'
);

CREATE INDEX IF NOT EXISTS professional_applications_publication_idx ON professional_applications(publication_status);
