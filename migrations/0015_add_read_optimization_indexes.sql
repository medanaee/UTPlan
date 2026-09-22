-- Migration 0015: Add composite indexes to prevent full-table scans and optimize read spikes
-- Specifically targeting courses(deleted_at, name), professors(deleted_at, name), and offerings(deleted_at)

CREATE INDEX IF NOT EXISTS idx_courses_deleted_name ON courses(deleted_at, name);
CREATE INDEX IF NOT EXISTS idx_courses_faculty_deleted ON courses(faculty_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_professors_deleted_name ON professors(deleted_at, last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_professors_faculty_deleted ON professors(faculty_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_offerings_deleted ON course_offerings(deleted_at);
