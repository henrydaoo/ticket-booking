import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { Pool } from 'pg';
import { BOOKING_CONFIG, BookingConfig } from '../config';

const TOPICS: Record<string, string> = {
  BookingConfirmed: 'booking.booking-confirmed.v1',
  RefundRequested: 'payment.refund-requested.v1',
};

@Injectable()
export class BookingOutboxLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingOutboxLifecycle.name);
  private readonly producer: Producer;
  private timer?: NodeJS.Timeout;
  private connected = false;
  private running = false;

  constructor(
    kafka: Kafka,
    private readonly pool: Pool,
    @Inject(BOOKING_CONFIG) private readonly config: BookingConfig,
  ) {
    this.producer = kafka.producer();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.producer.connect();
      this.connected = true;
      this.timer = setInterval(() => {
        void this.publishOnce().catch((error: unknown) =>
          this.logger.error('Booking outbox publish failed', error instanceof Error ? error.stack : String(error)),
        );
      }, 1000);
      this.timer.unref();
      void this.publishOnce();
    } catch (error) {
      this.logger.error('Booking outbox producer connection failed', error instanceof Error ? error.message : String(error));
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
        const result = await client.query(
          `WITH candidates AS (
             SELECT event_id
             FROM booking_outbox_events
             WHERE (status = 'PENDING' AND next_attempt_at <= NOW())
                OR (status = 'PUBLISHING' AND lease_until < NOW())
             ORDER BY created_at, event_id
             LIMIT 50
             FOR UPDATE SKIP LOCKED
           )
           UPDATE booking_outbox_events AS outbox
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
          if (!topic) throw new Error(`Unsupported booking outbox event: ${event.event_type}`);
          await this.producer.send({
            topic,
            messages: [{ key: event.aggregate_id, value: JSON.stringify(event.payload) }],
          });
          await this.pool.query(
            `UPDATE booking_outbox_events
             SET status = 'PUBLISHED', published_at = NOW(),
                 lease_until = NULL, last_error = NULL
             WHERE event_id = $1 AND status = 'PUBLISHING'`,
            [event.event_id],
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.pool.query(
            `UPDATE booking_outbox_events
             SET status = 'PENDING',
                 next_attempt_at = NOW() + make_interval(secs => $2),
                 lease_until = NULL, last_error = $3
             WHERE event_id = $1 AND status = 'PUBLISHING'`,
            [event.event_id, Math.min(60, 2 ** Math.max(0, event.attempt_count - 1)), message.slice(0, 1000)],
          );
          this.logger.error(`Booking outbox event ${event.event_id} publication failed`, message);
        }
      }
    } finally {
      this.running = false;
    }
  }
}
