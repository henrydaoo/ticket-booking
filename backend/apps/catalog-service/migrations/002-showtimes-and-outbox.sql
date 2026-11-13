ALTER TABLE screens
  ADD COLUMN IF NOT EXISTS pricing_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS showtimes (
  id UUID PRIMARY KEY,
  movie_id UUID NOT NULL REFERENCES movies(id),
  screen_id UUID NOT NULL REFERENCES screens(id),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  sale_opens_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT', 'PUBLISHED')),
  published_at TIMESTAMPTZ,
  prices JSONB,
  pricing_version INTEGER,
  layout_version INTEGER,
  seats JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at),
  CHECK (
    status = 'DRAFT'
    OR (
      sale_opens_at IS NOT NULL
      AND published_at IS NOT NULL
      AND prices IS NOT NULL
      AND pricing_version IS NOT NULL
      AND layout_version IS NOT NULL
      AND seats IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS showtimes_discovery_idx
  ON showtimes (start_at, screen_id)
  WHERE status = 'PUBLISHED';

CREATE TABLE IF NOT EXISTS catalog_outbox_events (
  event_id UUID PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type = 'ShowtimePublished'),
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  aggregate_type TEXT NOT NULL CHECK (aggregate_type = 'Showtime'),
  aggregate_id UUID NOT NULL,
  correlation_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PUBLISHING', 'PUBLISHED')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_until TIMESTAMPTZ,
  last_error TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_outbox_showtime_published_once_idx
  ON catalog_outbox_events (aggregate_id, event_type);

CREATE INDEX IF NOT EXISTS catalog_outbox_pending_idx
  ON catalog_outbox_events (next_attempt_at, occurred_at)
  WHERE status <> 'PUBLISHED';
