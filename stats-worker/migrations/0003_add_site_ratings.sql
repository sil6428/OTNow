CREATE TABLE IF NOT EXISTS site_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS site_ratings_created_at_idx ON site_ratings(created_at);
