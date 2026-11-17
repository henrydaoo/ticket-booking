ALTER TABLE ticket_outbox_events
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE ticket_outbox_events
  DROP CONSTRAINT IF EXISTS ticket_outbox_events_status_check;

ALTER TABLE ticket_outbox_events
  ADD CONSTRAINT ticket_outbox_events_status_check
  CHECK (status IN ('PENDING', 'PUBLISHING', 'PUBLISHED'));

CREATE INDEX IF NOT EXISTS ticket_outbox_pending_idx
  ON ticket_outbox_events (next_attempt_at, created_at, event_id)
  WHERE status <> 'PUBLISHED';
