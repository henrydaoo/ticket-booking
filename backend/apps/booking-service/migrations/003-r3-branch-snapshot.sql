ALTER TABLE showtime_inventory
  ADD COLUMN IF NOT EXISTS branch_id UUID;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS branch_id UUID;
