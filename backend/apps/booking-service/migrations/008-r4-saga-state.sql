CREATE TABLE IF NOT EXISTS booking_sagas (
  booking_id UUID PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  payment_id UUID,
  state TEXT NOT NULL CHECK (state IN (
    'AWAITING_PAYMENT',
    'PAYMENT_PROCESSING',
    'CONFIRMED',
    'COMPENSATING',
    'RECONCILING',
    'COMPLETED',
    'FAILED'
  )),
  last_event_id TEXT,
  last_error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_until TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP INDEX IF EXISTS booking_sagas_recovery_idx;

CREATE INDEX booking_sagas_recovery_idx
  ON booking_sagas (state, next_action_at)
  WHERE state NOT IN ('CONFIRMED', 'COMPLETED', 'FAILED');

CREATE UNIQUE INDEX IF NOT EXISTS booking_refund_requested_once_idx
  ON booking_outbox_events (aggregate_id, event_type)
  WHERE event_type = 'RefundRequested';
