-- Lunch Calendar — D1 schema
-- Run locally:     npm run setup:db
-- Run in prod:     wrangler d1 execute lunch-calendar --file=schema.sql

CREATE TABLE IF NOT EXISTS photos (
  date        TEXT PRIMARY KEY,   -- YYYY-MM-DD
  sha         TEXT NOT NULL,      -- SHA-256 hex of the original file
  uploaded_at TEXT NOT NULL       -- ISO 8601 timestamp
);

CREATE INDEX IF NOT EXISTS idx_sha ON photos(sha);
