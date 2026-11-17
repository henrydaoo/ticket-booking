ALTER TABLE booking_outbox_events
  ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE booking_outbox_events
  DROP CONSTRAINT IF EXISTS booking_outbox_events_status_check;

ALTER TABLE booking_outbox_events
  ADD CONSTRAINT booking_outbox_events_status_check
  CHECK (status IN ('PENDING', 'PUBLISHING', 'PUBLISHED'));

CREATE INDEX IF NOT EXISTS booking_outbox_pending_idx
  ON booking_outbox_events (next_attempt_at, created_at, event_id)
  WHERE status <> 'PUBLISHED';
