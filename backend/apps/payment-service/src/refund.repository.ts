import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';

@Injectable()
export class RefundRepository {
  async findDueForReconciliation(client: PoolClient, limit: number): Promise<Array<{
    id: string;
    paymentId: string;
    providerReference: string;
    amountVnd: number;
    attemptCount: number;
  }>> {
    const result = await client.query(
      `SELECT refund.id, refund.payment_id, payment.provider_reference,
              refund.amount_vnd, refund.attempt_count
       FROM refunds AS refund
       JOIN payments AS payment ON payment.id = refund.payment_id
       WHERE refund.status = 'PROCESSING'
         AND refund.next_attempt_at <= NOW()
         AND payment.provider_reference IS NOT NULL
       ORDER BY refund.updated_at, refund.id
       LIMIT $1
       FOR UPDATE OF refund SKIP LOCKED`,
      [limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      paymentId: row.payment_id,
      providerReference: row.provider_reference,
      amountVnd: row.amount_vnd,
      attemptCount: row.attempt_count,
    }));
  }

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
           attempt_count = attempt_count + 1,
           next_attempt_at = CASE WHEN $2 = 'PROCESSING'
             THEN NOW() + make_interval(secs => LEAST(900, 2 ^ GREATEST(0, attempt_count)))
             ELSE next_attempt_at END,
           updated_at = NOW()
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
