import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { TransactionRunner } from '../../../infrastructure/database/transaction.runner';
import { ShowtimeEvent } from '../showtime.types';

type OutboxClaim = {
  event_id: string;
  event_type: 'ShowtimePublished';
  aggregate_id: string;
  payload: ShowtimeEvent;
  attempt_count: number;
};

@Injectable()
export class CatalogOutboxRepository {
  constructor(@Inject(Pool) private readonly database: Pool, private readonly transactions: TransactionRunner) {}

  async claimOutboxEvents(limit: number): Promise<OutboxClaim[]> {
    return this.transactions.run(async (client) => {
      const result = await client.query<OutboxClaim>(
        `WITH candidates AS (
           SELECT event_id
           FROM catalog_outbox_events
           WHERE (status = 'PENDING' AND next_attempt_at <= NOW())
              OR (status = 'PUBLISHING' AND lease_until < NOW())
           ORDER BY occurred_at, event_id
           LIMIT $1
           FOR UPDATE SKIP LOCKED
         )
         UPDATE catalog_outbox_events AS outbox
         SET status = 'PUBLISHING',
             attempt_count = outbox.attempt_count + 1,
             lease_until = NOW() + INTERVAL '30 seconds'
         FROM candidates
         WHERE outbox.event_id = candidates.event_id
         RETURNING outbox.event_id, outbox.event_type,
                   outbox.aggregate_id, outbox.payload, outbox.attempt_count`,
        [limit],
      );
      return result.rows;
    });
  }

  async markOutboxPublished(eventId: string): Promise<void> {
    const result = await this.database.query(
      `UPDATE catalog_outbox_events
       SET status = 'PUBLISHED', published_at = NOW(),
           lease_until = NULL, last_error = NULL
       WHERE event_id = $1 AND status = 'PUBLISHING'`,
      [eventId],
    );
    if (result.rowCount !== 1) {
      throw new Error('Claimed Catalog outbox event was not available to mark published');
    }
  }

  async markOutboxFailed(
    eventId: string,
    attemptCount: number,
    errorMessage: string,
  ): Promise<void> {
    const retryDelaySeconds = Math.min(60, 2 ** Math.max(0, attemptCount - 1));
    const result = await this.database.query(
      `UPDATE catalog_outbox_events
       SET status = 'PENDING',
           next_attempt_at = NOW() + make_interval(secs => $2),
           lease_until = NULL,
           last_error = $3
       WHERE event_id = $1 AND status = 'PUBLISHING'`,
      [eventId, retryDelaySeconds, errorMessage.slice(0, 1000)],
    );
    if (result.rowCount !== 1) {
      throw new Error('Claimed Catalog outbox event was not available to reschedule');
    }
  }
}
