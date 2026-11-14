ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS customer_id UUID,
  ADD COLUMN IF NOT EXISTS payment_url TEXT;

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_idempotency_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS payments_customer_idempotency_idx
  ON payments (customer_id, idempotency_key)
  WHERE customer_id IS NOT NULL;
