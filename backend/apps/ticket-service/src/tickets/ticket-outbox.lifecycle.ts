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
      const result = await client.query<TicketOutboxRow>(
        `SELECT event_id, event_type, aggregate_id, payload
         FROM ticket_outbox_events
         WHERE status = 'PENDING'
         ORDER BY created_at, event_id
         LIMIT 50
         FOR UPDATE SKIP LOCKED`,
      );
      for (const event of result.rows) {
        const topic = TOPICS[event.event_type];
        if (!topic) throw new Error(`Unsupported ticket outbox event: ${event.event_type}`);
        await this.producer.send({
          topic,
          messages: [{ key: event.aggregate_id, value: JSON.stringify(event.payload) }],
        });
        await client.query(
          `UPDATE ticket_outbox_events
           SET status = 'PUBLISHED', published_at = NOW()
           WHERE event_id = $1`,
          [event.event_id],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      if (client) await client.query('ROLLBACK');
      throw error;
    } finally {
      client?.release();
      this.running = false;
    }
  }
}
