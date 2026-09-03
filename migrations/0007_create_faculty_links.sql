-- 0007_create_faculty_links.sql
-- Table for linking provider/source faculties to consumer/target faculties

CREATE TABLE IF NOT EXISTS faculty_links (
  id TEXT PRIMARY KEY,
  target_faculty_id TEXT NOT NULL,
  source_faculty_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (target_faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
  FOREIGN KEY (source_faculty_id) REFERENCES faculties(id) ON DELETE CASCADE,
  UNIQUE(target_faculty_id, source_faculty_id)
);

CREATE INDEX IF NOT EXISTS idx_faculty_links_target ON faculty_links(target_faculty_id);
CREATE INDEX IF NOT EXISTS idx_faculty_links_source ON faculty_links(source_faculty_id);
