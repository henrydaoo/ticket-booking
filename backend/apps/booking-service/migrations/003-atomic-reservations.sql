ALTER TABLE showtime_seats
  ADD COLUMN IF NOT EXISTS price_vnd INTEGER;

ALTER TABLE showtime_seats
  DROP CONSTRAINT IF EXISTS showtime_seats_price_vnd_check;

ALTER TABLE showtime_seats
  ADD CONSTRAINT showtime_seats_price_vnd_check
  CHECK (price_vnd IS NULL OR price_vnd >= 0);

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS reservations_customer_idempotency_idx
  ON reservations (customer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
