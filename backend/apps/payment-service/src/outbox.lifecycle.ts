import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { Pool } from 'pg';
import { PAYMENT_CONFIG, PaymentConfig } from './config';

const TOPICS: Record<string, string> = {
  PaymentSucceeded: 'payment.payment-succeeded.v1',
  PaymentFailed: 'payment.payment-failed.v1',
  RefundCompleted: 'payment.refund-completed.v1',
  RefundFailed: 'payment.refund-failed.v1',
};

@Injectable()
export class PaymentOutboxLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentOutboxLifecycle.name);
  private readonly producer: Producer;
  private timer?: NodeJS.Timeout;
  private running = false;
  private connected = false;

  constructor(
    kafka: Kafka,
    private readonly pool: Pool,
    @Inject(PAYMENT_CONFIG) private readonly config: PaymentConfig,
  ) {
    this.producer = kafka.producer();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.producer.connect();
      this.connected = true;
      this.timer = setInterval(() => {
        void this.publishOnce().catch((error: unknown) =>
          this.logger.error(
            'Payment outbox publish failed',
            error instanceof Error ? error.stack : String(error),
          ),
        );
      }, 1000);
      this.timer.unref();
      void this.publishOnce();
    } catch (error) {
      this.logger.error(
        'Payment outbox producer connection failed',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    if (this.connected) await this.producer.disconnect();
    this.connected = false;
  }

  private async publishOnce(): Promise<void> {
    if (!this.connected || this.running) return;
    this.running = true;
    try {
      const client = await this.pool.connect();
      let events;
      try {
        await client.query('BEGIN');
        const result = await client.query<{
          event_id: string;
          event_type: string;
          aggregate_id: string;
          payload: unknown;
          attempt_count: number;
        }>(
          `WITH candidates AS (
             SELECT event_id
             FROM payment_outbox_events
             WHERE (status = 'PENDING' AND next_attempt_at <= NOW())
                OR (status = 'PUBLISHING' AND lease_until < NOW())
             ORDER BY created_at, event_id
             LIMIT 50
             FOR UPDATE SKIP LOCKED
           )
           UPDATE payment_outbox_events AS outbox
           SET status = 'PUBLISHING',
               attempt_count = outbox.attempt_count + 1,
               lease_until = NOW() + INTERVAL '30 seconds'
           FROM candidates
           WHERE outbox.event_id = candidates.event_id
           RETURNING outbox.event_id, outbox.event_type,
                     outbox.aggregate_id, outbox.payload, outbox.attempt_count`,
        );
        events = result.rows;
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      for (const event of events) {
        try {
          const topic = TOPICS[event.event_type];
          if (!topic) throw new Error(`Unsupported payment outbox event: ${event.event_type}`);
          await this.producer.send({
            topic,
            messages: [{ key: event.aggregate_id, value: JSON.stringify(event.payload) }],
          });
          await this.pool.query(
            `UPDATE payment_outbox_events
             SET status = 'PUBLISHED', published_at = NOW(),
                 lease_until = NULL, last_error = NULL
             WHERE event_id = $1 AND status = 'PUBLISHING'`,
            [event.event_id],
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.pool.query(
            `UPDATE payment_outbox_events
             SET status = 'PENDING',
                 next_attempt_at = NOW() + make_interval(secs => $2),
                 lease_until = NULL, last_error = $3
             WHERE event_id = $1 AND status = 'PUBLISHING'`,
            [event.event_id, Math.min(60, 2 ** Math.max(0, event.attempt_count - 1)), message.slice(0, 1000)],
          );
          this.logger.error(`Payment outbox event ${event.event_id} publication failed`, message);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
