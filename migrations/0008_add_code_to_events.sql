-- Migration: Add code column to course_events table
ALTER TABLE course_events ADD COLUMN code TEXT;
CREATE INDEX IF NOT EXISTS idx_events_code ON course_events(code);
