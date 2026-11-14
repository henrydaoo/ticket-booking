CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS showtime_seats (
  showtime_id UUID NOT NULL,
  seat_id UUID NOT NULL,
  seat_label TEXT NOT NULL,
  seat_type TEXT NOT NULL CHECK (seat_type IN ('STANDARD', 'VIP', 'COUPLE')),
  status TEXT NOT NULL DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'HELD', 'BOOKED')),
  reservation_id UUID,
  booking_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (showtime_id, seat_id)
);

CREATE INDEX IF NOT EXISTS showtime_seats_reservation_idx
  ON showtime_seats (reservation_id)
  WHERE reservation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  showtime_id UUID NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('ACTIVE', 'PAYMENT_PENDING', 'CONFIRMED', 'EXPIRED', 'CANCELLED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reservations_expiration_idx
  ON reservations (status, expires_at);

CREATE TABLE IF NOT EXISTS reservation_seats (
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  showtime_id UUID NOT NULL,
  seat_id UUID NOT NULL,
  price_vnd INTEGER NOT NULL CHECK (price_vnd >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (reservation_id, seat_id),
  FOREIGN KEY (showtime_id, seat_id)
    REFERENCES showtime_seats(showtime_id, seat_id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  reservation_id UUID NOT NULL UNIQUE REFERENCES reservations(id),
  showtime_id UUID NOT NULL,
  status TEXT NOT NULL
    CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED')),
  total_vnd INTEGER NOT NULL CHECK (total_vnd >= 0),
  payment_deadline_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_outbox_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  aggregate_id UUID NOT NULL,
  correlation_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PUBLISHING', 'PUBLISHED')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
