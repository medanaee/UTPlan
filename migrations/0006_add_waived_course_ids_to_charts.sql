-- Migration 0006: Add waived_course_ids column to charts table
ALTER TABLE charts ADD COLUMN waived_course_ids TEXT;
