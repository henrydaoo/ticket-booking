import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { ShowtimePublishedEvent } from './showtime-published';

export type InventoryInitializationResult = 'initialized' | 'duplicate' | 'already_ready';

@Injectable()
export class BookingInventoryRepository {
  async initializeInTransaction(
    client: PoolClient,
    event: ShowtimePublishedEvent,
  ): Promise<InventoryInitializationResult> {
    const consumed = await client.query(
      `INSERT INTO booking_consumed_events
         (event_id, event_type, aggregate_id, correlation_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [event.eventId, event.eventType, event.aggregateId, event.correlationId],
    );
    if (consumed.rowCount === 0) {
      return 'duplicate';
    }

    const existing = await client.query<{
      screen_id: string;
      pricing_version: number;
      layout_version: number;
    }>(
      `SELECT screen_id, pricing_version, layout_version
       FROM showtime_inventory
       WHERE showtime_id = $1
       FOR UPDATE`,
      [event.payload.showtimeId],
    );
    if ((existing.rowCount ?? 0) > 0) {
      const current = existing.rows[0];
      if (
        current.screen_id !== event.payload.screenId ||
        current.pricing_version !== event.payload.pricingVersion ||
        current.layout_version !== event.payload.layoutVersion
      ) {
        throw new Error(`Conflicting inventory snapshot for showtime ${event.payload.showtimeId}`);
      }
      return 'already_ready';
    }

    await client.query(
      `INSERT INTO showtime_inventory
         (showtime_id, screen_id, status, pricing_version, layout_version, source_event_id)
       VALUES ($1, $2, 'READY', $3, $4, $5)`,
      [
        event.payload.showtimeId,
        event.payload.screenId,
        event.payload.pricingVersion,
        event.payload.layoutVersion,
        event.eventId,
      ],
    );

    for (const seat of event.payload.seats) {
      await client.query(
        `INSERT INTO showtime_seats
          (showtime_id, seat_id, seat_label, seat_type, price_vnd, status)
        VALUES ($1, $2, $3, $4, $5, 'AVAILABLE')
        ON CONFLICT (showtime_id, seat_id) DO UPDATE
        SET seat_label = EXCLUDED.seat_label,
            seat_type = EXCLUDED.seat_type,
            price_vnd = EXCLUDED.price_vnd,
            updated_at = NOW()
        WHERE showtime_seats.status = 'AVAILABLE'`,
        [
         event.payload.showtimeId,
         seat.id,
         seat.label,
         seat.type,
         event.payload.prices[seat.type],
        ],
      );
    }

    return 'initialized';
  }
}
