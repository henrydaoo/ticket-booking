ALTER TABLE showtime_inventory
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS customer_email TEXT;
