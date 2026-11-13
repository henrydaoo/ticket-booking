import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { TransactionRunner } from '../../infrastructure/database/transaction.runner';
import { CatalogDomainError } from '../../common/catalog.errors';
import { SeatType } from '../screens/dto/screen.dto';
import { ShowtimeQueryDto, UpdateDraftShowtimeDto } from './dto/showtime.dto';
import { PhysicalSeat, ShowtimeEvent, ShowtimeResponse } from './showtime.types';

export type ShowtimeDbRow = {
  id: string;
  movie_id: string;
  movie_status: ShowtimeResponse['movieStatus'];
  branch_id: string;
  screen_id: string;
  start_at: Date;
  end_at: Date;
  sale_opens_at: Date | null;
  status: ShowtimeResponse['status'];
  prices: ShowtimeResponse['prices'];
  pricing_version: number | null;
  layout_version: number | null;
  seats: PhysicalSeat[] | null;
};

const SHOWTIME_SELECT = `
  SELECT st.id, st.movie_id, m.status AS movie_status,
         sc.branch_id, st.screen_id, st.start_at, st.end_at,
         st.sale_opens_at, st.status, st.prices,
         st.pricing_version, st.layout_version, st.seats
  FROM showtimes st
  JOIN movies m ON m.id = st.movie_id
  JOIN screens sc ON sc.id = st.screen_id
`;

@Injectable()
export class ShowtimesRepository {
  constructor(@Inject(Pool) private readonly database: Pool, private readonly transactions: TransactionRunner) {}

  async createShowtime(input: {
    id: string;
    movieId: string;
    screenId: string;
    startAt: Date;
    endAt: Date;
    saleOpensAt: Date | null;
  }): Promise<ShowtimeDbRow | undefined> {
    return this.transactions.run(async (client) => {
      const screen = await client.query<{ id: string }>(
        'SELECT id FROM screens WHERE id = $1 FOR UPDATE',
        [input.screenId],
      );
      if (screen.rowCount !== 1) {
        return undefined;
      }
      const movie = await client.query(
        'SELECT id FROM movies WHERE id = $1',
        [input.movieId],
      );
      if (movie.rowCount !== 1) {
        throw new CatalogDomainError('NOT_FOUND', 'Movie not found');
      }

      await this.assertNoScheduleConflict(
        client,
        input.screenId,
        input.startAt,
        input.endAt,
      );
      await client.query(
        `INSERT INTO showtimes
         (id, movie_id, screen_id, start_at, end_at, sale_opens_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          input.id,
          input.movieId,
          input.screenId,
          input.startAt,
          input.endAt,
          input.saleOpensAt,
        ],
      );
      return this.findShowtimeWithClient(client, input.id);
    });
  }

  async updateDraftShowtime(
    showtimeId: string,
    input: UpdateDraftShowtimeDto,
  ): Promise<ShowtimeDbRow | undefined> {
    return this.transactions.run(async (client) => {
      const current = await client.query<{ screen_id: string }>(
        'SELECT screen_id FROM showtimes WHERE id = $1',
        [showtimeId],
      );
      if (current.rowCount !== 1) {
        return undefined;
      }
      const screenId = current.rows[0].screen_id;
      const screen = await client.query(
        'SELECT id FROM screens WHERE id = $1 FOR UPDATE',
        [screenId],
      );
      if (screen.rowCount !== 1) {
        throw new CatalogDomainError('NOT_FOUND', 'Screen not found');
      }
      const lockedShowtime = await client.query<{
        movie_id: string;
        start_at: Date;
        end_at: Date;
        sale_opens_at: Date | null;
        status: ShowtimeResponse['status'];
      }>(
        `SELECT movie_id, start_at, end_at, sale_opens_at, status
         FROM showtimes WHERE id = $1 FOR UPDATE`,
        [showtimeId],
      );
      if (lockedShowtime.rowCount !== 1) {
        return undefined;
      }
      if (lockedShowtime.rows[0].status !== 'DRAFT') {
        throw new CatalogDomainError(
          'INVALID_STATE',
          'Only draft showtimes can be changed',
        );
      }

      const startAt = input.startAt ? new Date(input.startAt) : lockedShowtime.rows[0].start_at;
      const endAt = input.endAt ? new Date(input.endAt) : lockedShowtime.rows[0].end_at;
      if (endAt.getTime() <= startAt.getTime()) {
        throw new CatalogDomainError(
          'INVALID_STATE',
          'Showtime end must be later than its start',
        );
      }
      const movieId = input.movieId ?? lockedShowtime.rows[0].movie_id;
      if (input.movieId) {
        const movie = await client.query(
          'SELECT id FROM movies WHERE id = $1',
          [input.movieId],
        );
        if (movie.rowCount !== 1) {
          throw new CatalogDomainError('NOT_FOUND', 'Movie not found');
        }
      }
      await this.assertNoScheduleConflict(
        client,
        screenId,
        startAt,
        endAt,
        showtimeId,
      );

      await client.query(
        `UPDATE showtimes
         SET movie_id = $2, start_at = $3, end_at = $4,
             sale_opens_at = COALESCE($5, sale_opens_at), updated_at = NOW()
         WHERE id = $1`,
        [
          showtimeId,
          movieId,
          startAt,
          endAt,
          input.saleOpensAt ? new Date(input.saleOpensAt) : null,
        ],
      );
      return this.findShowtimeWithClient(client, showtimeId);
    });
  }

  async publishShowtime(input: {
    showtimeId: string;
    eventId: string;
    correlationId: string;
    occurredAt: Date;
    saleOpensAt?: Date;
  }): Promise<ShowtimeDbRow | undefined> {
    return this.transactions.run(async (client) => {
      const initial = await client.query<{ screen_id: string }>(
        'SELECT screen_id FROM showtimes WHERE id = $1',
        [input.showtimeId],
      );
      if (initial.rowCount !== 1) {
        return undefined;
      }
      const screenId = initial.rows[0].screen_id;
      const screenResult = await client.query<{
        branch_id: string;
        capacity: number;
        pricing_version: number;
      }>(
        `SELECT branch_id, capacity, pricing_version
         FROM screens WHERE id = $1 FOR UPDATE`,
        [screenId],
      );
      if (screenResult.rowCount !== 1) {
        throw new CatalogDomainError('NOT_FOUND', 'Screen not found');
      }
      const showtimeResult = await client.query<{
        movie_id: string;
        start_at: Date;
        end_at: Date;
        sale_opens_at: Date | null;
        status: ShowtimeResponse['status'];
      }>(
        `SELECT movie_id, start_at, end_at, sale_opens_at, status
         FROM showtimes WHERE id = $1 FOR UPDATE`,
        [input.showtimeId],
      );
      if (showtimeResult.rowCount !== 1) {
        return undefined;
      }
      const showtime = showtimeResult.rows[0];
      if (showtime.status !== 'DRAFT') {
        throw new CatalogDomainError(
          'INVALID_STATE',
          'Only draft showtimes can be published',
        );
      }
      await this.assertNoScheduleConflict(
        client,
        screenId,
        showtime.start_at,
        showtime.end_at,
        input.showtimeId,
      );

      const seatsResult = await client.query<{
        id: string;
        label: string;
        seat_type: SeatType;
        row_label: string;
        seat_number: number;
      }>(
        `SELECT id, label, seat_type, row_label, seat_number
         FROM screen_seats
         WHERE screen_id = $1
         ORDER BY row_label, seat_number`,
        [screenId],
      );
      if (
        seatsResult.rowCount !== screenResult.rows[0].capacity ||
        seatsResult.rowCount === 0
      ) {
        throw new CatalogDomainError(
          'MISSING_LAYOUT',
          'A complete seat layout is required before publishing',
        );
      }
      const seats: PhysicalSeat[] = seatsResult.rows.map((seat) => ({
        id: seat.id,
        label: seat.label,
        type: seat.seat_type,
        row: seat.row_label,
        number: seat.seat_number,
      }));

      const priceResult = await client.query<{
        seat_type: SeatType;
        price_vnd: number;
      }>(
        `SELECT seat_type, price_vnd
         FROM screen_seat_type_prices
         WHERE screen_id = $1`,
        [screenId],
      );
      const prices = Object.fromEntries(
        priceResult.rows.map((price) => [price.seat_type, price.price_vnd]),
      );
      const missingPrice = [...new Set(seats.map((seat) => seat.type))]
        .find((seatType) => prices[seatType] === undefined);
      if (missingPrice) {
        throw new CatalogDomainError(
          'MISSING_PRICE',
          `A price is required for seat type ${missingPrice}`,
        );
      }

      const saleOpensAt =
        input.saleOpensAt ?? showtime.sale_opens_at ?? input.occurredAt;
      const layoutVersion = await client.query<{ layout_version: number }>(
        'SELECT layout_version FROM screens WHERE id = $1',
        [screenId],
      );
      const event: ShowtimeEvent = {
        eventId: input.eventId,
        eventType: 'ShowtimePublished',
        schemaVersion: 1,
        aggregateType: 'Showtime',
        aggregateId: input.showtimeId,
        occurredAt: input.occurredAt.toISOString(),
        correlationId: input.correlationId,
        payload: {
          showtimeId: input.showtimeId,
          movieId: showtime.movie_id,
          branchId: screenResult.rows[0].branch_id,
          screenId,
          startAt: showtime.start_at.toISOString(),
          endAt: showtime.end_at.toISOString(),
          saleOpensAt: saleOpensAt.toISOString(),
          reservationCutoffAt: new Date(
            showtime.start_at.getTime() - 15 * 60 * 1000,
          ).toISOString(),
          prices,
          pricingVersion: screenResult.rows[0].pricing_version,
          layoutVersion: layoutVersion.rows[0].layout_version,
          seats,
        },
      };

      await client.query(
        `UPDATE showtimes
         SET status = 'PUBLISHED', sale_opens_at = $2, published_at = $3,
             prices = $4::jsonb, pricing_version = $5, layout_version = $6,
             seats = $7::jsonb, updated_at = NOW()
         WHERE id = $1`,
        [
          input.showtimeId,
          saleOpensAt,
          input.occurredAt,
          JSON.stringify(prices),
          screenResult.rows[0].pricing_version,
          layoutVersion.rows[0].layout_version,
          JSON.stringify(seats),
        ],
      );
      await client.query(
        `INSERT INTO catalog_outbox_events
         (event_id, event_type, schema_version, aggregate_type, aggregate_id,
          correlation_id, occurred_at, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          event.eventId,
          event.eventType,
          event.schemaVersion,
          event.aggregateType,
          event.aggregateId,
          event.correlationId,
          input.occurredAt,
          JSON.stringify(event),
        ],
      );
      return this.findShowtimeWithClient(client, input.showtimeId);
    });
  }

  async listPublishedShowtimes(
    filter: ShowtimeQueryDto,
  ): Promise<ShowtimeDbRow[]> {
    const values: unknown[] = [];
    const conditions = ["st.status = 'PUBLISHED'"];
    if (filter.movieId) {
      values.push(filter.movieId);
      conditions.push(`st.movie_id = $${values.length}`);
    }
    if (filter.branchId) {
      values.push(filter.branchId);
      conditions.push(`sc.branch_id = $${values.length}`);
    }
    if (filter.from) {
      values.push(new Date(filter.from));
      conditions.push(`st.start_at >= $${values.length}`);
    }
    if (filter.to) {
      values.push(new Date(filter.to));
      conditions.push(`st.start_at < $${values.length}`);
    }
    const result = await this.database.query<ShowtimeDbRow>(
      `${SHOWTIME_SELECT}
       WHERE ${conditions.join(' AND ')}
       ORDER BY st.start_at ASC, st.id ASC`,
      values,
    );
    return result.rows;
  }

  async listDraftShowtimes(branchIds?: string[]): Promise<ShowtimeDbRow[]> {
    if (branchIds && branchIds.length === 0) {
      return [];
    }
    const values: unknown[] = [];
    let branchCondition = '';
    if (branchIds) {
      values.push(branchIds);
      branchCondition = `AND sc.branch_id = ANY($${values.length}::uuid[])`;
    }
    const result = await this.database.query<ShowtimeDbRow>(
      `${SHOWTIME_SELECT}
       WHERE st.status = 'DRAFT' ${branchCondition}
       ORDER BY st.start_at ASC, st.id ASC`,
      values,
    );
    return result.rows;
  }

  async findPublishedShowtime(
    showtimeId: string,
  ): Promise<ShowtimeDbRow | undefined> {
    const result = await this.database.query<ShowtimeDbRow>(
      `${SHOWTIME_SELECT}
       WHERE st.id = $1 AND st.status = 'PUBLISHED'`,
      [showtimeId],
    );
    return result.rows[0];
  }

  async findShowtime(showtimeId: string): Promise<ShowtimeDbRow | undefined> {
    const result = await this.database.query<ShowtimeDbRow>(
      `${SHOWTIME_SELECT} WHERE st.id = $1`,
      [showtimeId],
    );
    return result.rows[0];
  }

  private async assertNoScheduleConflict(
    client: PoolClient,
    screenId: string,
    startAt: Date,
    endAt: Date,
    excludingShowtimeId?: string,
  ): Promise<void> {
    const values: unknown[] = [screenId, startAt, endAt];
    let excludeClause = '';
    if (excludingShowtimeId) {
      values.push(excludingShowtimeId);
      excludeClause = `AND id <> $${values.length}`;
    }
    const conflict = await client.query(
      `SELECT 1
       FROM showtimes
       WHERE screen_id = $1
        AND start_at < $3::timestamptz + INTERVAL '30 minutes'
        AND end_at + INTERVAL '30 minutes' > $2::timestamptz
         ${excludeClause}
       LIMIT 1`,
      values,
    );
    if (conflict.rowCount) {
      throw new CatalogDomainError(
        'SCHEDULE_CONFLICT',
        'Showtimes on the same screen require a 30-minute buffer',
      );
    }
  }

  private async findShowtimeWithClient(
    client: PoolClient,
    showtimeId: string,
  ): Promise<ShowtimeDbRow | undefined> {
    const result = await client.query<ShowtimeDbRow>(
      `${SHOWTIME_SELECT} WHERE st.id = $1`,
      [showtimeId],
    );
    return result.rows[0];
  }
}
