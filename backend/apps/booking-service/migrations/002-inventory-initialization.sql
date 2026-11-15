CREATE TABLE IF NOT EXISTS showtime_inventory (
  showtime_id UUID PRIMARY KEY,
  screen_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('READY')),
  pricing_version INTEGER NOT NULL CHECK (pricing_version > 0),
  layout_version INTEGER NOT NULL CHECK (layout_version > 0),
  source_event_id UUID NOT NULL UNIQUE,
  initialized_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_consumed_events (
  event_id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  correlation_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS booking_consumed_events_aggregate_idx
  ON booking_consumed_events (aggregate_id, event_type);
