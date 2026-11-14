import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PAYMENT_CONFIG, PaymentConfig } from './config';
import { PaymentProviderPort } from './provider/payment-provider.port';
import { RefundRepository } from './refund.repository';

export type RefundRequestedEvent = {
  eventId: string;
  payload: {
    bookingId: string;
    paymentId: string;
    amountVnd: number;
    reasonCode: string;
  };
};

@Injectable()
export class RefundService {
  constructor(
    private readonly pool: Pool,
    private readonly refunds: RefundRepository,
    @Inject('PAYMENT_PROVIDER') private readonly provider: PaymentProviderPort,
    @Inject(PAYMENT_CONFIG) private readonly config: PaymentConfig,
  ) {}

  async process(event: RefundRequestedEvent): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const payment = await client.query<{
        provider_reference: string | null;
        status: string;
      }>(
        `SELECT provider_reference, status FROM payments WHERE id = $1 FOR SHARE`,
        [event.payload.paymentId],
      );
      if ((payment.rowCount ?? 0) === 0 || !payment.rows[0].provider_reference) {
        throw new Error('PAYMENT_NOT_FOUND');
      }
      const refund = await this.refunds.createOrGet(client, {
        paymentId: event.payload.paymentId,
        amountVnd: event.payload.amountVnd,
        idempotencyKey: `refund:${event.payload.paymentId}:${event.payload.reasonCode}`,
        reasonCode: event.payload.reasonCode,
      });
      if (refund.status === 'SUCCEEDED') {
        await client.query('COMMIT');
        return;
      }
      await this.refunds.updateResult(client, refund.id, 'PROCESSING');
      await client.query('COMMIT');

      const result = await this.provider.createRefund({
        paymentId: event.payload.paymentId,
        providerReference: payment.rows[0].provider_reference,
        amountVnd: event.payload.amountVnd,
        idempotencyKey: `refund:${event.payload.paymentId}:${event.payload.reasonCode}`,
        orderInfo: `Refund booking ${event.payload.bookingId}`,
        transactionDate: new Date(),
        clientIp: '127.0.0.1',
      });
      const updateClient = await this.pool.connect();
      try {
        await updateClient.query('BEGIN');
        await this.refunds.updateResult(
          updateClient,
          refund.id,
          result.status === 'SUCCEEDED' ? 'SUCCEEDED' : result.status === 'PENDING' ? 'PROCESSING' : 'FAILED',
          result.providerReference,
        );
        await this.refunds.updatePaymentState(
          updateClient,
          event.payload.paymentId,
          result.status === 'SUCCEEDED' ? 'REFUNDED' : 'REFUND_PENDING',
        );
        await updateClient.query('COMMIT');
      } catch (error) {
        await updateClient.query('ROLLBACK');
        throw error;
      } finally {
        updateClient.release();
      }
    } finally {
      if (!client.release) return;
      client.release();
    }
  }
}
