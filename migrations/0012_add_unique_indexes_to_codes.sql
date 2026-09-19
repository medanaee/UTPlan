-- Migration 0012: Enforce UNIQUE on code for professors, course_offerings, and course_events

DROP INDEX IF EXISTS idx_professors_code;
CREATE UNIQUE INDEX IF NOT EXISTS idx_professors_code ON professors(code) WHERE code IS NOT NULL;

DROP INDEX IF EXISTS idx_offerings_code;
CREATE UNIQUE INDEX IF NOT EXISTS idx_offerings_code ON course_offerings(code) WHERE code IS NOT NULL;

DROP INDEX IF EXISTS idx_events_code;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_code ON course_events(code) WHERE code IS NOT NULL;
