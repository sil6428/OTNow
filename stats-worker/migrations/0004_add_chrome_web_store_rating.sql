CREATE TABLE IF NOT EXISTS chrome_web_store_rating (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  average_rating REAL NOT NULL CHECK (average_rating BETWEEN 0 AND 5),
  rating_count INTEGER NOT NULL CHECK (rating_count >= 1),
  checked_at TEXT NOT NULL
);

INSERT OR IGNORE INTO chrome_web_store_rating (id, average_rating, rating_count, checked_at)
VALUES (1, 5.0, 2, '2026-10-12T00:00:00.000Z');
