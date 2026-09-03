-- Migration 0009: Add soft delete support to course_events, and purge deleted records in hard-delete tables
ALTER TABLE course_events ADD COLUMN deleted_at TEXT;
CREATE INDEX IF NOT EXISTS idx_events_deleted ON course_events(deleted_at);

DELETE FROM reviews WHERE deleted_at IS NOT NULL;
DELETE FROM offering_resources WHERE deleted_at IS NOT NULL;
