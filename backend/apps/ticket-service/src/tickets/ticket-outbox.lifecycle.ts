import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { Pool, PoolClient } from 'pg';

type TicketOutboxRow = {
  event_id: string;
  event_type: string;
  aggregate_id: string;
  payload: unknown;
};

const TOPICS: Record<string, string> = {
  TicketIssued: 'ticket.ticket-issued.v1',
  TicketCheckedIn: 'ticket.ticket-checked-in.v1',
  TicketCheckInReversed: 'ticket.ticket-check-in-reversed.v1',
};

@Injectable()
export class TicketOutboxLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TicketOutboxLifecycle.name);
  private readonly producer: Producer;
  private timer?: NodeJS.Timeout;
  private connected = false;
  private running = false;

  constructor(
    kafka: Kafka,
    private readonly pool: Pool,
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
            'Ticket outbox publish failed',
            error instanceof Error ? error.stack : String(error),
          ),
        );
      }, 1000);
      this.timer.unref();
      void this.publishOnce().catch((error: unknown) =>
        this.logger.error(
          'Ticket outbox publish failed',
          error instanceof Error ? error.stack : String(error),
        ),
      );
    } catch (error) {
      this.logger.error(
        'Ticket outbox producer connection failed',
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
    let client: PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');
      const result = await client.query<TicketOutboxRow & { attempt_count: number }>(
        `WITH candidates AS (
           SELECT event_id
           FROM ticket_outbox_events
           WHERE (status = 'PENDING' AND next_attempt_at <= NOW())
              OR (status = 'PUBLISHING' AND lease_until < NOW())
           ORDER BY created_at, event_id
           LIMIT 50
           FOR UPDATE SKIP LOCKED
         )
         UPDATE ticket_outbox_events AS outbox
         SET status = 'PUBLISHING',
             attempt_count = outbox.attempt_count + 1,
             lease_until = NOW() + INTERVAL '30 seconds'
         FROM candidates
         WHERE outbox.event_id = candidates.event_id
         RETURNING outbox.event_id, outbox.event_type,
                   outbox.aggregate_id, outbox.payload, outbox.attempt_count`,
      );
      await client.query('COMMIT');
      client.release();
      client = undefined;
      for (const event of result.rows) {
        try {
          const topic = TOPICS[event.event_type];
          if (!topic) throw new Error(`Unsupported ticket outbox event: ${event.event_type}`);
          await this.producer.send({
            topic,
            messages: [{ key: event.aggregate_id, value: JSON.stringify(event.payload) }],
          });
          await this.pool.query(
            `UPDATE ticket_outbox_events
             SET status = 'PUBLISHED', published_at = NOW(),
                 lease_until = NULL, last_error = NULL
             WHERE event_id = $1 AND status = 'PUBLISHING'`,
            [event.event_id],
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.pool.query(
            `UPDATE ticket_outbox_events
             SET status = 'PENDING',
                 next_attempt_at = NOW() + make_interval(secs => $2),
                 lease_until = NULL, last_error = $3
             WHERE event_id = $1 AND status = 'PUBLISHING'`,
            [event.event_id, Math.min(60, 2 ** Math.max(0, event.attempt_count - 1)), message.slice(0, 1000)],
          );
          this.logger.error(`Ticket outbox event ${event.event_id} publication failed`, message);
        }
      }
    } catch (error) {
      if (client) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      client?.release();
      this.running = false;
    }
  }
}
