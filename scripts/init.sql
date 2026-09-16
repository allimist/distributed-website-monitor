CREATE TABLE IF NOT EXISTS websites (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checks (
  id BIGSERIAL PRIMARY KEY,
  website_id INTEGER NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  status_code INTEGER,
  response_time_ms INTEGER,
  ok BOOLEAN NOT NULL,
  error TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checks_website_time ON checks(website_id, checked_at DESC);
