CREATE TABLE IF NOT EXISTS installations (
  id_hash TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  version TEXT NOT NULL,
  total_items INTEGER NOT NULL DEFAULT 0,
  assignments INTEGER NOT NULL DEFAULT 0,
  quizzes INTEGER NOT NULL DEFAULT 0,
  discussions INTEGER NOT NULL DEFAULT 0,
  events INTEGER NOT NULL DEFAULT 0,
  notes INTEGER NOT NULL DEFAULT 0,
  other_items INTEGER NOT NULL DEFAULT 0,
  reminders_sent INTEGER NOT NULL DEFAULT 0,
  moved_deadlines INTEGER NOT NULL DEFAULT 0,
  manual_completions INTEGER NOT NULL DEFAULT 0,
  successful_syncs INTEGER NOT NULL DEFAULT 0,
  active_days INTEGER NOT NULL DEFAULT 0,
  rating INTEGER DEFAULT NULL CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  report_count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS installations_last_seen_idx ON installations(last_seen);
CREATE INDEX IF NOT EXISTS installations_first_seen_idx ON installations(first_seen);
CREATE INDEX IF NOT EXISTS installations_version_idx ON installations(version);

CREATE TABLE IF NOT EXISTS site_ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS site_ratings_created_at_idx ON site_ratings(created_at);
