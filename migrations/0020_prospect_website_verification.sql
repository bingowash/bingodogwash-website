ALTER TABLE prospects ADD COLUMN website_verified INTEGER NOT NULL DEFAULT 0 CHECK (website_verified IN (0,1));
