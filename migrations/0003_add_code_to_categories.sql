-- Migration 0003: Add code column to visual_categories and rule_categories
ALTER TABLE visual_categories ADD COLUMN code TEXT;
ALTER TABLE rule_categories ADD COLUMN code TEXT;

CREATE INDEX IF NOT EXISTS idx_visual_categories_code ON visual_categories(code);
CREATE INDEX IF NOT EXISTS idx_rule_categories_code ON rule_categories(code);
