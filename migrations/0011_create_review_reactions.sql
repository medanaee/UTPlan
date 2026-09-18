-- Migration 0011: Create review_reactions table
CREATE TABLE IF NOT EXISTS review_reactions (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  user_id TEXT,
  client_id TEXT,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_review_reactions_review ON review_reactions(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reactions_user ON review_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_review_reactions_client ON review_reactions(client_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_user_unique ON review_reactions(review_id, user_id, emoji) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_client_unique ON review_reactions(review_id, client_id, emoji) WHERE user_id IS NULL AND client_id IS NOT NULL;
