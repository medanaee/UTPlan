-- Migration 0004: Remove redundant professor_id from course_offerings table

-- Step 1: Ensure all offering professors from course_offerings are safely inserted into offering_professors junction table
INSERT OR IGNORE INTO offering_professors (id, offering_id, professor_id, is_primary, created_at)
SELECT 'op_' || o.id || '_' || o.professor_id, o.id, o.professor_id, 1, o.created_at
FROM course_offerings o
WHERE o.professor_id IS NOT NULL AND o.professor_id != '';

-- Step 2: Create temp tables for children that reference course_offerings
CREATE TABLE IF NOT EXISTS temp_offering_professors AS SELECT * FROM offering_professors;
CREATE TABLE IF NOT EXISTS temp_course_events AS SELECT * FROM course_events;
CREATE TABLE IF NOT EXISTS temp_offering_resources AS SELECT * FROM offering_resources;

-- Step 3: Clear child tables temporarily
DELETE FROM offering_professors;
DELETE FROM course_events;
DELETE FROM offering_resources;

-- Step 4: Rebuild course_offerings without professor_id
CREATE TABLE IF NOT EXISTS course_offerings_new (
  id TEXT PRIMARY KEY,
  code TEXT,
  course_id TEXT NOT NULL,
  description TEXT,
  finalized_semesters TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

INSERT INTO course_offerings_new (id, code, course_id, description, finalized_semesters, created_at, deleted_at)
SELECT id, code, course_id, description, finalized_semesters, created_at, deleted_at
FROM course_offerings;

DROP TABLE course_offerings;
ALTER TABLE course_offerings_new RENAME TO course_offerings;

-- Step 5: Restore child tables data and clean up temp tables
INSERT INTO offering_professors SELECT * FROM temp_offering_professors;
INSERT INTO course_events SELECT * FROM temp_course_events;
INSERT INTO offering_resources SELECT * FROM temp_offering_resources;

DROP TABLE temp_offering_professors;
DROP TABLE temp_course_events;
DROP TABLE temp_offering_resources;

-- Step 6: Recreate indexes
DROP INDEX IF EXISTS idx_offerings_professor;
CREATE INDEX IF NOT EXISTS idx_offerings_course ON course_offerings(course_id);
CREATE INDEX IF NOT EXISTS idx_offerings_code ON course_offerings(code);
