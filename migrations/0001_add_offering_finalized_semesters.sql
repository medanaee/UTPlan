-- Migration 0001: Add finalized_semesters column to course_offerings table
-- Stores JSON array of finalized semester strings e.g. ["1403-1", "1404-2", "1405-3"]

ALTER TABLE course_offerings ADD COLUMN finalized_semesters TEXT;
