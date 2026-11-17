CREATE TABLE IF NOT EXISTS ticket_consumed_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY,
  booking_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  showtime_id TEXT NOT NULL,
  seat_id TEXT NOT NULL,
  ticket_code TEXT NOT NULL UNIQUE,
  qr_token_ciphertext TEXT NOT NULL,
  qr_token_nonce TEXT NOT NULL,
  qr_token_auth_tag TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VALID'
    CHECK (status IN ('VALID', 'USED', 'CANCELLED')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, seat_id)
);

CREATE INDEX IF NOT EXISTS tickets_customer_issued_at_idx
  ON tickets (customer_id, issued_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS ticket_outbox_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PUBLISHED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);
