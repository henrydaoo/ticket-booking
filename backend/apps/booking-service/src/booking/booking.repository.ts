import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { BookingResponse } from './booking.types';

type BookingRow = {
  id: string;
  reservation_id: string;
  customer_id: string;
  customer_email: string | null;
  showtime_id: string;
  branch_id: string | null;
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
  eventType: 'PaymentSucceeded' | 'PaymentFailed' | 'RefundCompleted' | 'RefundFailed';
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
    await client.query(
      `UPDATE booking_sagas
       SET state = CASE
         WHEN state IN ('AWAITING_PAYMENT', 'RECONCILING') THEN 'PAYMENT_PROCESSING'
         ELSE state
       END,
       last_event_id = $2,
       payment_id = COALESCE(payment_id, $3),
       attempt_count = attempt_count + 1,
       updated_at = NOW()
       WHERE booking_id = $1`,
      [event.payload.bookingId, event.eventId, event.payload.paymentId],
    );

    const bookingResult = await client.query<BookingRow>(
      `SELECT id, reservation_id, customer_id, customer_email, showtime_id, branch_id, status,
              total_vnd, payment_deadline_at
       FROM bookings
       WHERE id = $1
       FOR UPDATE`,
      [event.payload.bookingId],
    );
    if ((bookingResult.rowCount ?? 0) === 0) return 'processed';
    const booking = bookingResult.rows[0];
    if (event.eventType === 'RefundCompleted' || event.eventType === 'RefundFailed') {
      const succeeded = event.eventType === 'RefundCompleted';
      await client.query(
        `UPDATE bookings
         SET status = CASE WHEN $2 THEN 'REFUNDED' ELSE status END,
             updated_at = NOW()
         WHERE id = $1 AND ($2 OR status = 'REFUND_PENDING')`,
        [booking.id, succeeded],
      );
      await client.query(
        `UPDATE booking_sagas
         SET state = CASE WHEN $2 THEN 'COMPLETED' ELSE 'RECONCILING' END,
             last_event_id = $3,
             last_error = CASE WHEN $2 THEN NULL ELSE 'REFUND_FAILED' END,
             completed_at = CASE WHEN $2 THEN NOW() ELSE completed_at END,
             next_action_at = CASE WHEN $2 THEN next_action_at ELSE NOW() + INTERVAL '60 seconds' END,
             updated_at = NOW()
         WHERE booking_id = $1`,
        [booking.id, succeeded, event.eventId],
      );
      return 'processed';
    }
    if (event.eventType === 'PaymentSucceeded') {
      if (
        booking.status !== 'PENDING_PAYMENT' ||
        event.payload.amountVnd !== booking.total_vnd
      ) {
        await this.insertRefundRequested(client, booking, event);
        await this.markSaga(client, booking.id, 'COMPENSATING', event.eventId);
        return 'processed';
      }
      if (!booking.branch_id) throw new Error('BOOKING_BRANCH_UNAVAILABLE');
      const reservationResult = await client.query<{ status: string }>(
        `SELECT status FROM reservations WHERE id = $1 FOR UPDATE`,
        [booking.reservation_id],
      );
      if ((reservationResult.rowCount ?? 0) === 0 || reservationResult.rows[0].status !== 'PAYMENT_PENDING') {
        await this.insertRefundRequested(client, booking, event);
        await this.markSaga(client, booking.id, 'COMPENSATING', event.eventId);
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
        await this.markSaga(client, booking.id, 'COMPENSATING', event.eventId);
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
      await this.markSaga(client, booking.id, 'CONFIRMED', event.eventId);
      if (!booking.customer_email) throw new Error('BOOKING_CUSTOMER_EMAIL_UNAVAILABLE');
      const showtime = await client.query<{ start_at: Date | string | null }>(
        `SELECT start_at
         FROM showtime_inventory
         WHERE showtime_id = $1
         FOR SHARE`,
        [booking.showtime_id],
      );
      if (!showtime.rows[0]?.start_at) throw new Error('SHOWTIME_START_UNAVAILABLE');
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
              recipientEmail: booking.customer_email,
              showtimeId: booking.showtime_id,
              showtimeStartAt: new Date(showtime.rows[0].start_at).toISOString(),
              branchId: booking.branch_id,
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
      await this.markSaga(client, booking.id, 'COMPLETED', event.eventId, true);
    }
    return 'processed';
  }

  private async markSaga(
    client: PoolClient,
    bookingId: string,
    state: 'CONFIRMED' | 'COMPENSATING' | 'COMPLETED',
    eventId: string,
    terminal = false,
  ): Promise<void> {
    await client.query(
      `UPDATE booking_sagas
       SET state = $2,
           last_event_id = $3,
           completed_at = CASE WHEN $4 THEN NOW() ELSE completed_at END,
           updated_at = NOW()
       WHERE booking_id = $1`,
      [bookingId, state, eventId, terminal],
    );
  }

  private async insertRefundRequested(
    client: PoolClient,
    booking: BookingRow,
    event: PaymentEvent,
  ): Promise<void> {
    await client.query(
      `UPDATE bookings SET status = 'REFUND_PENDING', updated_at = NOW()
       WHERE id = $1 AND status IN ('PENDING_PAYMENT', 'CANCELLED')`,
      [booking.id],
    );
    await client.query(
      `INSERT INTO booking_outbox_events
         (event_type, schema_version, aggregate_id, correlation_id, payload)
       VALUES ('RefundRequested', 1, $1, $2, $3::jsonb)
       ON CONFLICT (aggregate_id, event_type) WHERE event_type = 'RefundRequested' DO NOTHING`,
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
      `SELECT id, reservation_id, customer_id, showtime_id, branch_id, status,
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

  async markPaymentInitiated(
    client: PoolClient,
    bookingId: string,
    paymentId: string,
  ): Promise<void> {
    await client.query(
      `UPDATE booking_sagas
       SET payment_id = COALESCE(payment_id, $2),
           state = CASE WHEN state = 'AWAITING_PAYMENT' THEN 'PAYMENT_PROCESSING' ELSE state END,
           updated_at = NOW()
       WHERE booking_id = $1`,
      [bookingId, paymentId],
    );
  }

  async listByCustomer(
    client: PoolClient,
    customerId: string,
  ): Promise<BookingResponse[]> {
    const result = await client.query<BookingRow>(
      `SELECT id, reservation_id, customer_id, showtime_id, branch_id, status,
              total_vnd, payment_deadline_at
       FROM bookings
       WHERE customer_id = $1
       ORDER BY created_at DESC, id DESC`,
      [customerId],
    );
    return Promise.all(result.rows.map((booking) => this.withSeats(client, booking)));
  }

  async findById(
    client: PoolClient,
    bookingId: string,
    customerId: string,
  ): Promise<BookingResponse | null> {
    const result = await client.query<BookingRow>(
      `SELECT id, reservation_id, customer_id, showtime_id, branch_id, status,
              total_vnd, payment_deadline_at
       FROM bookings
       WHERE id = $1 AND customer_id = $2`,
      [bookingId, customerId],
    );
    if ((result.rowCount ?? 0) === 0) return null;
    return this.withSeats(client, result.rows[0]);
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
      customerEmail: string;
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
    const inventory = await client.query<{ branch_id: string | null }>(
      `SELECT branch_id, start_at
       FROM showtime_inventory
       WHERE showtime_id = $1
       FOR SHARE`,
      [reservation.showtime_id],
    );
    if (!inventory.rows[0]?.branch_id) throw new Error('SHOWTIME_BRANCH_UNAVAILABLE');
    const totalVnd = reservationSeats.rows.reduce(
      (total, seat) => total + seat.price_vnd,
      0,
    );
    const booking = await client.query<BookingRow>(
      `INSERT INTO bookings
         (id, customer_id, customer_email, reservation_id, showtime_id, branch_id, idempotency_key,
          status, total_vnd, payment_deadline_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING_PAYMENT', $8, $9)
       RETURNING id, reservation_id, customer_id, customer_email, showtime_id, branch_id, status,
                 total_vnd, payment_deadline_at`,
      [
        input.bookingId,
        input.customerId,
        input.customerEmail,
        reservation.id,
        reservation.showtime_id,
        inventory.rows[0].branch_id,
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
      `INSERT INTO booking_sagas (booking_id, state, next_action_at)
       VALUES ($1, 'AWAITING_PAYMENT', NOW())
       ON CONFLICT (booking_id) DO NOTHING`,
      [input.bookingId],
    );
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

  async recoverCompensatingSagas(client: PoolClient, limit: number): Promise<number> {
    const result = await client.query<{
      booking_id: string;
      payment_id: string | null;
      total_vnd: number;
      last_event_id: string | null;
    }>(
      `SELECT saga.booking_id, saga.payment_id, booking.total_vnd, saga.last_event_id
       FROM booking_sagas AS saga
       JOIN bookings AS booking ON booking.id = saga.booking_id
       WHERE saga.state IN ('COMPENSATING', 'RECONCILING')
         AND saga.next_action_at <= NOW()
       ORDER BY saga.updated_at, saga.booking_id
       LIMIT $1
       FOR UPDATE OF saga SKIP LOCKED`,
      [limit],
    );
    for (const saga of result.rows) {
      if (!saga.payment_id) {
        await client.query(
          `UPDATE booking_sagas
           SET state = 'FAILED', last_error = 'COMPENSATION_PAYMENT_ID_UNAVAILABLE',
               completed_at = NOW(), updated_at = NOW()
           WHERE booking_id = $1`,
          [saga.booking_id],
        );
        continue;
      }
      const eventId = `${saga.booking_id}:RefundRequested`;
      await client.query(
        `INSERT INTO booking_outbox_events
           (event_type, schema_version, aggregate_id, correlation_id, payload)
         VALUES ('RefundRequested', 1, $1, $2, $3::jsonb)
         ON CONFLICT (aggregate_id, event_type) WHERE event_type = 'RefundRequested' DO NOTHING`,
        [
          saga.booking_id,
          `saga-recovery:${saga.booking_id}`,
          JSON.stringify({
            eventId,
            eventType: 'RefundRequested',
            schemaVersion: 1,
            aggregateType: 'Booking',
            aggregateId: saga.booking_id,
            occurredAt: new Date().toISOString(),
            correlationId: `saga-recovery:${saga.booking_id}`,
            payload: {
              bookingId: saga.booking_id,
              paymentId: saga.payment_id,
              amountVnd: saga.total_vnd,
              reasonCode: 'SAGA_COMPENSATION_RECOVERY',
            },
          }),
        ],
      );
      await client.query(
        `UPDATE booking_sagas
         SET state = 'RECONCILING',
             attempt_count = attempt_count + 1,
             next_action_at = NOW() + INTERVAL '60 seconds',
             updated_at = NOW()
         WHERE booking_id = $1`,
        [saga.booking_id],
      );
    }
    return result.rows.length;
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
