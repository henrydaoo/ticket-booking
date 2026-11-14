import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { PaymentResponse, PaymentStatus } from './payment.types';

type PaymentRow = {
  id: string;
  booking_id: string;
  status: PaymentStatus;
  amount_vnd: number;
  provider: 'VNPAY';
  payment_url: string | null;
  processing_deadline_at: Date;
};

@Injectable()
export class PaymentRepository {
  async findByIdempotencyKey(
    client: PoolClient,
    customerId: string,
    idempotencyKey: string,
  ): Promise<PaymentResponse | null> {
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`payment:${customerId}:${idempotencyKey}`],
    );
    const result = await client.query<PaymentRow>(
      `SELECT id, booking_id, status, amount_vnd, provider, payment_url,
              processing_deadline_at
       FROM payments
       WHERE customer_id = $1 AND idempotency_key = $2
       FOR UPDATE`,
      [customerId, idempotencyKey],
    );
    if ((result.rowCount ?? 0) === 0) return null;
    return this.toResponse(result.rows[0]);
  }

  async createPending(
    client: PoolClient,
    input: {
      paymentId: string;
      customerId: string;
      bookingId: string;
      idempotencyKey: string;
      amountVnd: number;
      processingDeadlineAt: Date;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO payments
         (id, customer_id, booking_id, idempotency_key, amount_vnd, status,
          provider, processing_deadline_at)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', 'VNPAY', $6)`,
      [
        input.paymentId,
        input.customerId,
        input.bookingId,
        input.idempotencyKey,
        input.amountVnd,
        input.processingDeadlineAt,
      ],
    );
  }

  async completeProviderCreation(
    client: PoolClient,
    paymentId: string,
    providerReference: string,
    paymentUrl: string,
  ): Promise<PaymentResponse> {
    const result = await client.query<PaymentRow>(
      `UPDATE payments
       SET provider_reference = $2, payment_url = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING id, booking_id, status, amount_vnd, provider, payment_url,
                 processing_deadline_at`,
      [paymentId, providerReference, paymentUrl],
    );
    if ((result.rowCount ?? 0) === 0) throw new Error('PAYMENT_NOT_FOUND');
    return this.toResponse(result.rows[0]);
  }

  private toResponse(row: PaymentRow): PaymentResponse {
    if (!row.payment_url) throw new Error('PAYMENT_URL_NOT_READY');
    return {
      paymentId: row.id,
      bookingId: row.booking_id,
      status: row.status,
      amountVnd: row.amount_vnd,
      provider: row.provider,
      paymentUrl: row.payment_url,
      processingDeadlineAt: new Date(row.processing_deadline_at).toISOString(),
    };
  }
}
