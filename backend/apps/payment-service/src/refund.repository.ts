import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';

@Injectable()
export class RefundRepository {
  async createOrGet(
    client: PoolClient,
    input: { paymentId: string; amountVnd: number; idempotencyKey: string; reasonCode: string },
  ): Promise<{ id: string; status: string; providerReference: string | null }> {
    const inserted = await client.query(
      `INSERT INTO refunds (payment_id, idempotency_key, amount_vnd, status, reason_code)
       VALUES ($1, $2, $3, 'PENDING', $4)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id, status, provider_reference`,
      [input.paymentId, input.idempotencyKey, input.amountVnd, input.reasonCode],
    );
    if ((inserted.rowCount ?? 0) > 0) return inserted.rows[0];
    const existing = await client.query(
      `SELECT id, status, provider_reference FROM refunds WHERE idempotency_key = $1 FOR UPDATE`,
      [input.idempotencyKey],
    );
    return existing.rows[0];
  }

  async updateResult(
    client: PoolClient,
    refundId: string,
    status: 'PROCESSING' | 'SUCCEEDED' | 'FAILED',
    providerReference?: string,
  ): Promise<void> {
    await client.query(
      `UPDATE refunds
       SET status = $2, provider_reference = COALESCE($3, provider_reference),
           attempt_count = attempt_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [refundId, status, providerReference || null],
    );
  }

  async updatePaymentState(
    client: PoolClient,
    paymentId: string,
    status: 'REFUND_PENDING' | 'REFUNDED',
  ): Promise<void> {
    await client.query(
      `UPDATE payments SET status = $2, updated_at = NOW() WHERE id = $1`,
      [paymentId, status],
    );
  }
}
