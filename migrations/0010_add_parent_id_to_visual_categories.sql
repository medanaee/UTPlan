-- Migration 0010: Add parent_id to visual_categories for hierarchical nesting
ALTER TABLE visual_categories ADD COLUMN parent_id TEXT REFERENCES visual_categories(id);
CREATE INDEX IF NOT EXISTS idx_visual_categories_parent ON visual_categories(parent_id);
