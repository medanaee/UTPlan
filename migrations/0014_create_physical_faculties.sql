-- Migration 0014: Create physical_faculties table and add optional physical_faculty_id to faculties

CREATE TABLE IF NOT EXISTS physical_faculties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  image_url TEXT,
  latitude REAL,
  longitude REAL,
  address TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_physical_faculties_deleted ON physical_faculties(deleted_at);
CREATE INDEX IF NOT EXISTS idx_physical_faculties_name ON physical_faculties(name);
CREATE INDEX IF NOT EXISTS idx_physical_faculties_code ON physical_faculties(code);
