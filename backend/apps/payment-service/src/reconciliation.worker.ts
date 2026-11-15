import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { PAYMENT_CONFIG, PaymentConfig } from './config';
import { PaymentProviderPort } from './provider/payment-provider.port';
import { ReconciliationRepository } from './reconciliation.repository';
import { PaymentRepository } from './payment.repository';

@Injectable()
export class ReconciliationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReconciliationWorker.name);
  private active?: Promise<void>;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly pool: Pool,
    private readonly reconciliation: ReconciliationRepository,
    private readonly payments: PaymentRepository,
    @Inject('PAYMENT_PROVIDER') private readonly provider: PaymentProviderPort,
    @Inject(PAYMENT_CONFIG) private readonly config: PaymentConfig,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.runOnce().catch((error: unknown) =>
        this.logger.error('Payment reconciliation worker failed', error instanceof Error ? error.stack : String(error)),
      );
    }, this.config.paymentReconciliationIntervalSeconds * 1000);
    this.timer.unref();
    void this.runOnce();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }

  async runOnce(): Promise<void> {
    if (this.active) return this.active;
    this.active = this.execute().finally(() => { this.active = undefined; });
    await this.active;
  }

  private async execute(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const candidates = await this.reconciliation.claimPayments(
        client,
        50,
        new Date(Date.now() + this.config.paymentReconciliationIntervalSeconds * 1000),
      );
      await client.query('COMMIT');
      for (const payment of candidates) {
        try {
          const result = await this.provider.queryPayment({
            paymentId: payment.id,
            providerReference: payment.providerReference,
            amountVnd: payment.amountVnd,
            transactionDate: payment.createdAt,
          });
          if (result.status === 'SUCCEEDED' || result.status === 'FAILED') {
            const callback = {
              provider: 'VNPAY' as const,
              providerEventId: `reconciliation:${payment.id}:${result.responseCode}`,
              signature: 'reconciliation',
              payload: {},
              providerReference: payment.providerReference,
              amountVnd: payment.amountVnd,
              success: result.status === 'SUCCEEDED',
              responseCode: result.responseCode,
              correlationId: `reconciliation:${payment.id}`,
            };
            const updateClient = await this.pool.connect();
            try {
              await updateClient.query('BEGIN');
              await this.payments.processWebhook(updateClient, callback);
              await updateClient.query('COMMIT');
            } catch (error) {
              await updateClient.query('ROLLBACK');
              throw error;
            } finally {
              updateClient.release();
            }
          } else {
            const retryClient = await this.pool.connect();
            try {
              await retryClient.query('BEGIN');
              await this.reconciliation.markAttempt(
                retryClient,
                payment.id,
                new Date(Date.now() + this.config.paymentReconciliationIntervalSeconds * 1000),
              );
              await retryClient.query('COMMIT');
            } finally {
              retryClient.release();
            }
          }
        } catch (error) {
          this.logger.error(
            `Payment reconciliation failed for ${payment.id}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    } finally {
      client.release();
    }
  }
}
