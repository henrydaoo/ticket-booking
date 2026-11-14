import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { BookingResponse } from './booking.types';

type BookingRow = {
  id: string;
  reservation_id: string;
  customer_id: string;
  showtime_id: string;
  status: BookingResponse['status'];
  total_vnd: number;
  payment_deadline_at: Date;
};

export type PaymentContext = {
  bookingId: string;
  customerId: string;
  status: BookingResponse['status'];
  totalVnd: number;
  paymentDeadlineAt: string;
};

export type PaymentEvent = {
  eventId: string;
  eventType: 'PaymentSucceeded' | 'PaymentFailed';
  correlationId: string;
  payload: {
    paymentId: string;
    bookingId: string;
    amountVnd?: number;
    provider?: string;
    providerReference?: string;
    reasonCode?: string;
    retryable?: boolean;
  };
};

@Injectable()
export class BookingRepository {
  async processPaymentEvent(client: PoolClient, event: PaymentEvent): Promise<'duplicate' | 'processed'> {
    const consumed = await client.query(
      `INSERT INTO booking_consumed_events
         (event_id, event_type, aggregate_id, correlation_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.eventId, event.eventType, event.payload.bookingId, event.correlationId],
    );
    if ((consumed.rowCount ?? 0) === 0) return 'duplicate';

    const bookingResult = await client.query<BookingRow>(
      `SELECT id, reservation_id, customer_id, showtime_id, status,
              total_vnd, payment_deadline_at
       FROM bookings
       WHERE id = $1
       FOR UPDATE`,
      [event.payload.bookingId],
    );
    if ((bookingResult.rowCount ?? 0) === 0) return 'processed';
    const booking = bookingResult.rows[0];
    if (event.eventType === 'PaymentSucceeded') {
      if (
        booking.status !== 'PENDING_PAYMENT' ||
        event.payload.amountVnd !== booking.total_vnd
      ) {
        await this.insertRefundRequested(client, booking, event);
        return 'processed';
      }
      const reservationResult = await client.query<{ status: string }>(
        `SELECT status FROM reservations WHERE id = $1 FOR UPDATE`,
        [booking.reservation_id],
      );
      if ((reservationResult.rowCount ?? 0) === 0 || reservationResult.rows[0].status !== 'PAYMENT_PENDING') {
        await this.insertRefundRequested(client, booking, event);
        return 'processed';
      }
      const seats = await client.query<{ seat_id: string; status: string; booking_id: string | null }>(
        `SELECT seat_id, status, booking_id
         FROM showtime_seats
         WHERE booking_id IS NULL AND reservation_id = $1
         FOR UPDATE`,
        [booking.reservation_id],
      );
      const bookingSeats = await client.query<{ seat_id: string }>(
        `SELECT seat_id FROM booking_seats WHERE booking_id = $1`,
        [booking.id],
      );
      const seatIds = new Set(bookingSeats.rows.map((seat) => seat.seat_id));
      if (
        seats.rows.length !== bookingSeats.rows.length ||
        seats.rows.some((seat) => seat.status !== 'HELD' || !seatIds.has(seat.seat_id))
      ) {
        await this.insertRefundRequested(client, booking, event);
        return 'processed';
      }
      await client.query(
        `UPDATE showtime_seats
         SET status = 'BOOKED', booking_id = $1, reservation_id = NULL, updated_at = NOW()
         WHERE reservation_id = $2 AND status = 'HELD'`,
        [booking.id, booking.reservation_id],
      );
      await client.query(
        `UPDATE reservations SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1`,
        [booking.reservation_id],
      );
      await client.query(
        `UPDATE bookings SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1`,
        [booking.id],
      );
      await client.query(
        `INSERT INTO booking_outbox_events
           (event_type, schema_version, aggregate_id, correlation_id, payload)
         VALUES ('BookingConfirmed', 1, $1, $2, $3::jsonb)`,
        [
          booking.id,
          event.correlationId,
          JSON.stringify({
            eventId: booking.id + ':BookingConfirmed',
            eventType: 'BookingConfirmed',
            schemaVersion: 1,
            aggregateType: 'Booking',
            aggregateId: booking.id,
            occurredAt: new Date().toISOString(),
            correlationId: event.correlationId,
            payload: {
              bookingId: booking.id,
              customerId: booking.customer_id,
              showtimeId: booking.showtime_id,
              totalVnd: booking.total_vnd,
              seats: bookingSeats.rows,
            },
          }),
        ],
      );
      return 'processed';
    }

    if (booking.status === 'PENDING_PAYMENT') {
      await client.query(
        `UPDATE bookings SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
        [booking.id],
      );
      await client.query(
        `UPDATE reservations
         SET status = 'CANCELLED', updated_at = NOW()
         WHERE id = $1 AND status = 'PAYMENT_PENDING'`,
        [booking.reservation_id],
      );
      await client.query(
        `UPDATE showtime_seats
         SET status = 'AVAILABLE', reservation_id = NULL, updated_at = NOW()
         WHERE reservation_id = $1 AND status = 'HELD'`,
        [booking.reservation_id],
      );
    }
    return 'processed';
  }

  private async insertRefundRequested(
    client: PoolClient,
    booking: BookingRow,
    event: PaymentEvent,
  ): Promise<void> {
    await client.query(
      `INSERT INTO booking_outbox_events
         (event_type, schema_version, aggregate_id, correlation_id, payload)
       VALUES ('RefundRequested', 1, $1, $2, $3::jsonb)`,
      [
        booking.id,
        event.correlationId,
        JSON.stringify({
          eventId: booking.id + ':RefundRequested',
          eventType: 'RefundRequested',
          schemaVersion: 1,
          aggregateType: 'Booking',
          aggregateId: booking.id,
          occurredAt: new Date().toISOString(),
          correlationId: event.correlationId,
          payload: {
            bookingId: booking.id,
            paymentId: event.payload.paymentId,
            amountVnd: booking.total_vnd,
            reasonCode: 'PAYMENT_SUCCEEDED_AFTER_SEAT_RELEASE',
          },
        }),
      ],
    );
  }
  async findPaymentContext(
    client: PoolClient,
    bookingId: string,
    customerId: string,
  ): Promise<PaymentContext | null> {
    const result = await client.query<BookingRow>(
      `SELECT id, reservation_id, customer_id, showtime_id, status,
              total_vnd, payment_deadline_at
       FROM bookings
       WHERE id = $1 AND customer_id = $2
       FOR SHARE`,
      [bookingId, customerId],
    );
    if ((result.rowCount ?? 0) === 0) return null;
    const booking = result.rows[0];
    return {
      bookingId: booking.id,
      customerId: booking.customer_id,
      status: booking.status,
      totalVnd: booking.total_vnd,
      paymentDeadlineAt: new Date(booking.payment_deadline_at).toISOString(),
    };
  }

  async findByIdempotencyKey(
    client: PoolClient,
    customerId: string,
    idempotencyKey: string,
  ): Promise<BookingResponse | null> {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
      [`booking:${customerId}:${idempotencyKey}`],
    );
    const result = await client.query<BookingRow>(
      `SELECT id, reservation_id, customer_id, showtime_id, status,
              total_vnd, payment_deadline_at
       FROM bookings
       WHERE customer_id = $1 AND idempotency_key = $2
       FOR UPDATE`,
      [customerId, idempotencyKey],
    );
    if ((result.rowCount ?? 0) === 0) return null;
    return this.withSeats(client, result.rows[0]);
  }

  async createFromReservation(
    client: PoolClient,
    input: {
      bookingId: string;
      customerId: string;
      reservationId: string;
      idempotencyKey: string;
      paymentDeadlineAt: Date;
    },
  ): Promise<BookingResponse> {
    const reservationResult = await client.query<{
      id: string;
      customer_id: string;
      showtime_id: string;
      status: string;
      expires_at: Date;
    }>(
      `SELECT id, customer_id, showtime_id, status, expires_at
       FROM reservations
       WHERE id = $1
       FOR UPDATE`,
      [input.reservationId],
    );
    if ((reservationResult.rowCount ?? 0) === 0) throw new Error('RESERVATION_NOT_FOUND');
    const reservation = reservationResult.rows[0];
    if (reservation.customer_id !== input.customerId) throw new Error('RESERVATION_FORBIDDEN');
    if (reservation.status !== 'ACTIVE') throw new Error('RESERVATION_NOT_ACTIVE');
    if (new Date(reservation.expires_at).getTime() <= Date.now()) {
      await this.expireReservation(client, input.reservationId);
      throw new Error('RESERVATION_EXPIRED');
    }

    const seats = await client.query(
      `SELECT seat_id, price_vnd, status
       FROM showtime_seats
       WHERE reservation_id = $1
       FOR UPDATE`,
      [input.reservationId],
    );
    if (seats.rows.length === 0 || seats.rows.some((seat) => seat.status !== 'HELD')) {
      throw new Error('RESERVATION_NOT_ACTIVE');
    }

    const reservationSeats = await client.query(
      `SELECT seat_id, price_vnd
       FROM reservation_seats
       WHERE reservation_id = $1
       ORDER BY seat_id`,
      [input.reservationId],
    );
    if (reservationSeats.rows.length !== seats.rows.length) {
      throw new Error('RESERVATION_NOT_ACTIVE');
    }
    const totalVnd = reservationSeats.rows.reduce(
      (total, seat) => total + seat.price_vnd,
      0,
    );
    const booking = await client.query<BookingRow>(
      `INSERT INTO bookings
         (id, customer_id, reservation_id, showtime_id, idempotency_key,
          status, total_vnd, payment_deadline_at)
       VALUES ($1, $2, $3, $4, $5, 'PENDING_PAYMENT', $6, $7)
       RETURNING id, reservation_id, customer_id, showtime_id, status,
                 total_vnd, payment_deadline_at`,
      [
        input.bookingId,
        input.customerId,
        reservation.id,
        reservation.showtime_id,
        input.idempotencyKey,
        totalVnd,
        input.paymentDeadlineAt,
      ],
    );
    for (const seat of reservationSeats.rows) {
      await client.query(
        `INSERT INTO booking_seats (booking_id, seat_id, price_vnd)
         VALUES ($1, $2, $3)`,
        [input.bookingId, seat.seat_id, seat.price_vnd],
      );
    }
    await client.query(
      `UPDATE reservations
       SET status = 'PAYMENT_PENDING', updated_at = NOW()
       WHERE id = $1 AND status = 'ACTIVE'`,
      [input.reservationId],
    );
    return this.withSeats(client, booking.rows[0]);
  }

  async expireDueReservations(client: PoolClient, limit: number): Promise<number> {
    const reservations = await client.query<{ id: string; showtime_id: string }>(
      `SELECT id, showtime_id
       FROM reservations
       WHERE status = 'ACTIVE' AND expires_at <= NOW()
       ORDER BY expires_at, id
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [limit],
    );
    for (const reservation of reservations.rows) {
      const seats = await client.query<{ seat_id: string }>(
        `SELECT seat_id
         FROM reservation_seats
         WHERE reservation_id = $1
         ORDER BY seat_id`,
        [reservation.id],
      );
      await this.expireReservation(client, reservation.id);
      await client.query(
        `INSERT INTO booking_outbox_events
           (event_type, schema_version, aggregate_id, correlation_id, payload)
         VALUES ('ReservationExpired', 1, $1, $2, $3::jsonb)`,
        [
          reservation.id,
          `reservation-expiration:${reservation.id}`,
          JSON.stringify({
            eventId: reservation.id,
            eventType: 'ReservationExpired',
            schemaVersion: 1,
            aggregateType: 'Reservation',
            aggregateId: reservation.id,
            occurredAt: new Date().toISOString(),
            correlationId: `reservation-expiration:${reservation.id}`,
            payload: {
              reservationId: reservation.id,
              bookingId: null,
              showtimeId: reservation.showtime_id,
              seatIds: seats.rows.map((seat) => seat.seat_id),
              expiredAt: new Date().toISOString(),
            },
          }),
        ],
      );
    }
    return reservations.rows.length;
  }

  private async expireReservation(client: PoolClient, reservationId: string): Promise<void> {
    await client.query(
      `UPDATE reservations
       SET status = 'EXPIRED', updated_at = NOW()
       WHERE id = $1 AND status = 'ACTIVE'`,
      [reservationId],
    );
    await client.query(
      `UPDATE showtime_seats
       SET status = 'AVAILABLE', reservation_id = NULL, updated_at = NOW()
       WHERE reservation_id = $1 AND status = 'HELD'`,
      [reservationId],
    );
  }

  private async withSeats(client: PoolClient, booking: BookingRow): Promise<BookingResponse> {
    const result = await client.query(
      `SELECT seat_id, price_vnd
       FROM booking_seats
       WHERE booking_id = $1
       ORDER BY seat_id`,
      [booking.id],
    );
    return {
      bookingId: booking.id,
      reservationId: booking.reservation_id,
      customerId: booking.customer_id,
      showtimeId: booking.showtime_id,
      status: booking.status,
      seats: result.rows.map((seat) => ({
        seatId: seat.seat_id,
        priceVnd: seat.price_vnd,
      })),
      totalVnd: booking.total_vnd,
      paymentDeadlineAt: new Date(booking.payment_deadline_at).toISOString(),
    };
  }
}
