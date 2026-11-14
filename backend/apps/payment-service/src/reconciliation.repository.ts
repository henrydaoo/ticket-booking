import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';

export type ReconciliationPayment = {
  id: string;
  bookingId: string;
  providerReference: string;
  amountVnd: number;
  createdAt: Date;
};

@Injectable()
export class ReconciliationRepository {
  async claimPayments(
    client: PoolClient,
    limit: number,
    claimUntil: Date,
  ): Promise<ReconciliationPayment[]> {
    const result = await client.query<{
      id: string;
      booking_id: string;
      provider_reference: string;
      amount_vnd: number;
      created_at: Date;
    }>(
      `SELECT id, booking_id, provider_reference, amount_vnd, created_at
       FROM payments
       WHERE status IN ('PENDING', 'PROCESSING')
         AND processing_deadline_at <= NOW()
         AND (next_reconciliation_at IS NULL OR next_reconciliation_at <= NOW())
         AND provider_reference IS NOT NULL
       ORDER BY processing_deadline_at, id
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit],
    );
    for (const row of result.rows) {
      await client.query(
        `UPDATE payments
         SET next_reconciliation_at = $2, updated_at = NOW()
         WHERE id = $1`,
        [row.id, claimUntil],
      );
    }
    return result.rows.map((row) => ({
      id: row.id,
      bookingId: row.booking_id,
      providerReference: row.provider_reference,
      amountVnd: row.amount_vnd,
      createdAt: row.created_at,
    }));
  }

  async markAttempt(client: PoolClient, paymentId: string, retryAt: Date): Promise<void> {
    await client.query(
      `UPDATE payments
       SET reconciliation_attempt_count = reconciliation_attempt_count + 1,
           last_reconciled_at = NOW(), next_reconciliation_at = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [paymentId, retryAt],
    );
  }
}
