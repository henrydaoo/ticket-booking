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
  customer_id: string;
  provider_reference: string | null;
};

@Injectable()
export class PaymentRepository {
  async processWebhook(
    client: PoolClient,
    input: {
      provider: 'VNPAY';
      providerEventId: string;
      signature: string;
      payload: Record<string, string>;
      providerReference: string;
      amountVnd: number;
      success: boolean;
      responseCode: string;
      correlationId: string;
    },
  ): Promise<'duplicate' | 'processed'> {
    const receipt = await client.query<{ status: string }>(
      `SELECT status
       FROM payment_webhook_receipts
       WHERE provider = $1 AND provider_event_id = $2
       FOR UPDATE`,
      [input.provider, input.providerEventId],
    );
    if ((receipt.rowCount ?? 0) > 0) return 'duplicate';

    const payment = await client.query<PaymentRow>(
      `SELECT id, booking_id, customer_id, status, amount_vnd, provider,
              provider_reference, payment_url, processing_deadline_at
       FROM payments
       WHERE provider = $1 AND provider_reference = $2
       FOR UPDATE`,
      [input.provider, input.providerReference],
    );
    if ((payment.rowCount ?? 0) === 0) throw new Error('PAYMENT_NOT_FOUND');
    const current = payment.rows[0];
    if (current.amount_vnd !== input.amountVnd) throw new Error('PAYMENT_AMOUNT_MISMATCH');

    await client.query(
      `INSERT INTO payment_webhook_receipts
         (provider, provider_event_id, payment_id, signature, payload, result_code, status)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'RECEIVED')`,
      [
        input.provider,
        input.providerEventId,
        current.id,
        input.signature,
        JSON.stringify(input.payload),
        input.responseCode,
      ],
    );

    const nextStatus: PaymentStatus = input.success ? 'SUCCEEDED' : 'FAILED';
    if (current.status === 'PENDING' || current.status === 'PROCESSING') {
      await client.query(
        `UPDATE payments
         SET status = $2, updated_at = NOW()
         WHERE id = $1`,
        [current.id, nextStatus],
      );
      await client.query(
        `INSERT INTO payment_outbox_events
           (event_type, schema_version, aggregate_id, correlation_id, payload)
         VALUES ($1, 1, $2, $3, $4::jsonb)`,
        [
          input.success ? 'PaymentSucceeded' : 'PaymentFailed',
          current.id,
          input.correlationId,
          JSON.stringify({
            eventId: current.id,
            eventType: input.success ? 'PaymentSucceeded' : 'PaymentFailed',
            schemaVersion: 1,
            aggregateType: 'Payment',
            aggregateId: current.id,
            occurredAt: new Date().toISOString(),
            correlationId: input.correlationId,
            payload: input.success
              ? {
                  paymentId: current.id,
                  bookingId: current.booking_id,
                  amountVnd: current.amount_vnd,
                  provider: current.provider,
                  providerReference: current.provider_reference,
                }
              : {
                  paymentId: current.id,
                  bookingId: current.booking_id,
                  reasonCode: 'PROVIDER_DECLINED',
                  retryable: false,
                },
          }),
        ],
      );
    }
    await client.query(
      `UPDATE payment_webhook_receipts
       SET status = 'PROCESSED', processed_at = NOW()
       WHERE provider = $1 AND provider_event_id = $2`,
      [input.provider, input.providerEventId],
    );
    return 'processed';
  }

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
