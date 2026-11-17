ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS branch_id TEXT,
  ADD COLUMN IF NOT EXISTS qr_token_digest TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS tickets_qr_token_digest_idx
  ON tickets (qr_token_digest)
  WHERE qr_token_digest IS NOT NULL;

CREATE TABLE IF NOT EXISTS ticket_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  actor_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  showtime_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reversed_at TIMESTAMPTZ,
  reversed_by TEXT,
  reversal_reason TEXT
);

CREATE INDEX IF NOT EXISTS ticket_check_ins_ticket_idx
  ON ticket_check_ins (ticket_id, checked_in_at DESC);

CREATE TABLE IF NOT EXISTS ticket_audit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  branch_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ticket_audit_records_ticket_idx
  ON ticket_audit_records (ticket_id, created_at DESC);
