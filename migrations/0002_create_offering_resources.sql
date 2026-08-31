-- Migration 0002: Create offering_resources table
-- Stores course offering learning resources (video, slide, archive, link)

CREATE TABLE IF NOT EXISTS offering_resources (
  id TEXT PRIMARY KEY,
  offering_id TEXT NOT NULL,
  title TEXT NOT NULL,
  term TEXT,
  type TEXT NOT NULL, -- 'video' | 'slide' | 'archive'
  url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (offering_id) REFERENCES course_offerings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_offering_resources_offering ON offering_resources(offering_id);
CREATE INDEX IF NOT EXISTS idx_offering_resources_type ON offering_resources(type);
