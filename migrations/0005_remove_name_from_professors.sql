-- ==============================================================================
-- Migration 0005: Remove redundant `name` column from `professors`
-- Ensures first_name & last_name are populated, drops `name`, rebuilds table cleanly.
-- Safe and idempotent across multiple executions.
-- ==============================================================================

-- 1. Populate first_name and last_name for any rows where they are NULL
UPDATE professors
SET first_name = TRIM(SUBSTR(name, 1, INSTR(name || ' ', ' ') - 1)),
    last_name = TRIM(SUBSTR(name, INSTR(name || ' ', ' ') + 1))
WHERE (first_name IS NULL OR first_name = '') AND name IS NOT NULL AND name != '';

UPDATE professors
SET last_name = COALESCE(NULLIF(last_name, ''), first_name, 'نامشخص'),
    first_name = COALESCE(NULLIF(first_name, ''), 'استاد')
WHERE first_name IS NULL OR last_name IS NULL OR first_name = '' OR last_name = '';

-- 2. Preserve offering_professors data
CREATE TABLE IF NOT EXISTS _temp_offering_professors AS SELECT * FROM offering_professors;

-- 3. Create new professors table without name column
CREATE TABLE IF NOT EXISTS professors_new (
  id TEXT PRIMARY KEY,
  faculty_id TEXT NOT NULL,
  code TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  title TEXT,
  email TEXT,
  links TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (faculty_id) REFERENCES faculties(id)
);

-- 4. Copy data into new table
INSERT OR REPLACE INTO professors_new (id, faculty_id, code, first_name, last_name, avatar_url, title, email, links, created_at, deleted_at)
SELECT id, faculty_id, code, COALESCE(first_name, 'استاد'), COALESCE(last_name, 'نامشخص'), avatar_url, title, email, links, created_at, deleted_at
FROM professors;

-- 5. Drop old table and rename new table
DROP TABLE IF EXISTS professors;
ALTER TABLE professors_new RENAME TO professors;

-- 6. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_professors_faculty ON professors(faculty_id);
CREATE INDEX IF NOT EXISTS idx_professors_code ON professors(code);
CREATE INDEX IF NOT EXISTS idx_professors_name ON professors(last_name, first_name);

-- 7. Restore junction table rows
INSERT OR IGNORE INTO offering_professors SELECT * FROM _temp_offering_professors;
DROP TABLE IF EXISTS _temp_offering_professors;
