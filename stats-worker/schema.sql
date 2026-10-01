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
  report_count INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS installations_last_seen_idx ON installations(last_seen);
CREATE INDEX IF NOT EXISTS installations_first_seen_idx ON installations(first_seen);
CREATE INDEX IF NOT EXISTS installations_version_idx ON installations(version);
