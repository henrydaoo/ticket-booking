ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_customer_idempotency_idx
  ON bookings (customer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS booking_seats (
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  seat_id UUID NOT NULL,
  price_vnd INTEGER NOT NULL CHECK (price_vnd >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (booking_id, seat_id)
);
