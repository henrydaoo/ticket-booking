ALTER TABLE payment_outbox_events
  ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE payment_outbox_events
  DROP CONSTRAINT IF EXISTS payment_outbox_events_status_check;

ALTER TABLE payment_outbox_events
  ADD CONSTRAINT payment_outbox_events_status_check
  CHECK (status IN ('PENDING', 'PUBLISHING', 'PUBLISHED'));

CREATE INDEX IF NOT EXISTS payment_outbox_pending_idx
  ON payment_outbox_events (next_attempt_at, created_at, event_id)
  WHERE status <> 'PUBLISHED';
