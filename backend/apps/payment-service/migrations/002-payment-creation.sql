ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS customer_id UUID,
  ADD COLUMN IF NOT EXISTS payment_url TEXT;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_idempotency_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS payments_customer_idempotency_idx
  ON payments (customer_id, idempotency_key)
  WHERE customer_id IS NOT NULL;

ALTER TABLE payment_webhook_receipts
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id),
  ADD COLUMN IF NOT EXISTS result_code TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN ('RECEIVED', 'PROCESSED', 'IGNORED'));

CREATE INDEX IF NOT EXISTS payment_webhook_receipts_payment_idx
  ON payment_webhook_receipts (payment_id);
