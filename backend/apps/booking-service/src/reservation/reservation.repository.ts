import { Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { ReservationResponse, ReservationSeat } from './reservation.types';

type ReservationRow = {
  id: string;
  customer_id: string;
  showtime_id: string;
  status: ReservationResponse['status'];
  expires_at: Date;
};

@Injectable()
export class ReservationRepository {
  constructor(private readonly pool: Pool) {}

  async findSeatMap(showtimeId: string): Promise<Array<ReservationSeat & { status: string }>> {
    const result = await this.pool.query(
      `SELECT seat_id, seat_label, seat_type, price_vnd, status
       FROM showtime_seats
       WHERE showtime_id = $1
       ORDER BY seat_label`,
      [showtimeId],
    );
    return result.rows.map((row) => ({
      seatId: row.seat_id,
      label: row.seat_label,
      type: row.seat_type,
      priceVnd: row.price_vnd,
      status: row.status,
    }));
  }

  async findByIdempotencyKey(
    client: PoolClient,
    customerId: string,
    idempotencyKey: string,
  ): Promise<ReservationResponse | null> {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`${customerId}:${idempotencyKey}`],
    );
    const result = await client.query<ReservationRow>(
      `SELECT id, customer_id, showtime_id, status, expires_at
       FROM reservations
       WHERE customer_id = $1 AND idempotency_key = $2
       FOR UPDATE`,
      [customerId, idempotencyKey],
    );
    if ((result.rowCount ?? 0) === 0) return null;
    return this.withSeats(client, result.rows[0]);
  }

  async createReservation(
    client: PoolClient,
    input: {
      reservationId: string;
      customerId: string;
      showtimeId: string;
      seatIds: string[];
      idempotencyKey: string;
      expiresAt: Date;
      prices: Record<string, number>;
    },
  ): Promise<ReservationResponse> {
    const seats = await client.query(
      `SELECT seat_id, seat_label, seat_type, price_vnd, status
       FROM showtime_seats
       WHERE showtime_id = $1 AND seat_id = ANY($2::uuid[])
       FOR UPDATE`,
      [input.showtimeId, input.seatIds],
    );
    if (seats.rows.length !== input.seatIds.length) {
      throw new Error('SEAT_NOT_FOUND');
    }
    if (seats.rows.some((seat) => seat.status !== 'AVAILABLE' || seat.price_vnd === null)) {
      throw new Error('SEAT_UNAVAILABLE');
    }
    if (
      seats.rows.some(
        (seat) =>
          !Number.isInteger(input.prices[seat.seat_type]) ||
          input.prices[seat.seat_type] < 0,
      )
    ) {
      throw new Error('PRICE_UNAVAILABLE');
    }

    const reservation = await client.query<ReservationRow>(
      `INSERT INTO reservations
         (id, customer_id, showtime_id, idempotency_key, status, expires_at)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5)
       RETURNING id, customer_id, showtime_id, status, expires_at`,
      [
        input.reservationId,
        input.customerId,
        input.showtimeId,
        input.idempotencyKey,
        input.expiresAt,
      ],
    );

    for (const seat of seats.rows) {
      await client.query(
        `INSERT INTO reservation_seats (reservation_id, showtime_id, seat_id, price_vnd)
         VALUES ($1, $2, $3, $4)`,
        [input.reservationId, input.showtimeId, seat.seat_id, input.prices[seat.seat_type]],
      );
    }
    await client.query(
      `UPDATE showtime_seats
       SET status = 'HELD', reservation_id = $2, updated_at = NOW()
       WHERE showtime_id = $1 AND seat_id = ANY($3::uuid[]) AND status = 'AVAILABLE'`,
      [input.showtimeId, input.reservationId, input.seatIds],
    );
    return this.withSeats(client, reservation.rows[0]);
  }

  async cancelReservation(
    client: PoolClient,
    reservationId: string,
    customerId: string,
  ): Promise<ReservationResponse> {
    const result = await client.query<ReservationRow>(
      `SELECT id, customer_id, showtime_id, status, expires_at
       FROM reservations
       WHERE id = $1
       FOR UPDATE`,
      [reservationId],
    );
    if ((result.rowCount ?? 0) === 0) throw new Error('RESERVATION_NOT_FOUND');
    const reservation = result.rows[0];
    if (reservation.customer_id !== customerId) throw new Error('RESERVATION_FORBIDDEN');
    if (reservation.status === 'ACTIVE') {
      await client.query(
        `UPDATE reservations
         SET status = 'CANCELLED', updated_at = NOW()
         WHERE id = $1`,
        [reservationId],
      );
      await client.query(
        `UPDATE showtime_seats
         SET status = 'AVAILABLE', reservation_id = NULL, updated_at = NOW()
         WHERE reservation_id = $1 AND status = 'HELD'`,
        [reservationId],
      );
      reservation.status = 'CANCELLED';
    } else if (reservation.status !== 'CANCELLED') {
      throw new Error('RESERVATION_NOT_ACTIVE');
    }
    return this.withSeats(client, reservation);
  }

  private async withSeats(client: PoolClient, reservation: ReservationRow): Promise<ReservationResponse> {
    const result = await client.query(
      `SELECT seat_id, price_vnd
       FROM reservation_seats
       WHERE reservation_id = $1
       ORDER BY seat_id`,
      [reservation.id],
    );
    const seatPrices = result.rows.map((row) => ({
      seatId: row.seat_id,
      priceVnd: row.price_vnd,
    }));
    return {
      reservationId: reservation.id,
      customerId: reservation.customer_id,
      showtimeId: reservation.showtime_id,
      status: reservation.status,
      seatIds: seatPrices.map((seat) => seat.seatId),
      seatPrices,
      totalVnd: seatPrices.reduce((total, seat) => total + seat.priceVnd, 0),
      expiresAt: new Date(reservation.expires_at).toISOString(),
    };
  }
}
