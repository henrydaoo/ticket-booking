import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { BookingConfirmedEvent, NewTicket, TicketRow } from './ticket.types';

export type TicketIssueResult = {
  duplicate: boolean;
  tickets: Array<Pick<TicketRow, 'ticket_id' | 'booking_id' | 'customer_id' | 'showtime_id' | 'seat_id' | 'ticket_code'>>;
};

@Injectable()
export class TicketRepository {
  async issueBookingConfirmed(
    client: PoolClient,
    event: BookingConfirmedEvent,
    newTickets: NewTicket[],
  ): Promise<TicketIssueResult> {
    const consumed = await client.query(
      `INSERT INTO ticket_consumed_events
         (event_id, event_type, aggregate_id, correlation_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id`,
      [event.eventId, event.eventType, event.aggregateId, event.correlationId],
    );
    if ((consumed.rowCount ?? 0) === 0) return { duplicate: true, tickets: [] };

    const insertedTickets: TicketIssueResult['tickets'] = [];
    for (const ticket of newTickets) {
      const inserted = await client.query<
        Pick<TicketRow, 'ticket_id' | 'booking_id' | 'customer_id' | 'showtime_id' | 'seat_id' | 'ticket_code'>
      >(
        `INSERT INTO tickets
           (id, booking_id, customer_id, showtime_id, branch_id, seat_id, ticket_code,
            qr_token_ciphertext, qr_token_nonce, qr_token_auth_tag, qr_token_digest)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (booking_id, seat_id) DO NOTHING
         RETURNING id AS ticket_id, booking_id, customer_id, showtime_id, seat_id, ticket_code`,
        [
          ticket.ticketId,
          ticket.bookingId,
          ticket.customerId,
          ticket.showtimeId,
          ticket.branchId,
          ticket.seatId,
          ticket.ticketCode,
          ticket.qrTokenCiphertext,
          ticket.qrTokenNonce,
          ticket.qrTokenAuthTag,
          ticket.qrTokenDigest,
        ],
      );
      if (inserted.rowCount) insertedTickets.push(inserted.rows[0]);
    }

    if (insertedTickets.length > 0) {
      const issuedEvent = {
        eventId: `${event.payload.bookingId}:TicketIssued`,
        eventType: 'TicketIssued',
        schemaVersion: 1,
        aggregateType: 'Booking',
        aggregateId: event.payload.bookingId,
        occurredAt: new Date().toISOString(),
        correlationId: event.correlationId,
        payload: {
          bookingId: event.payload.bookingId,
          customerId: event.payload.customerId,
          showtimeId: event.payload.showtimeId,
          tickets: insertedTickets.map((ticket) => ({
            ticketId: ticket.ticket_id,
            seatId: ticket.seat_id,
            ticketCode: ticket.ticket_code,
          })),
        },
      };
      await client.query(
        `INSERT INTO ticket_outbox_events
           (event_id, event_type, aggregate_id, correlation_id, payload)
         VALUES ($1, 'TicketIssued', $2, $3, $4::jsonb)
         ON CONFLICT (event_id) DO NOTHING`,
        [
          issuedEvent.eventId,
          issuedEvent.aggregateId,
          issuedEvent.correlationId,
          JSON.stringify(issuedEvent),
        ],
      );
    }

    return { duplicate: false, tickets: insertedTickets };
  }

  async listByCustomer(client: PoolClient, customerId: string): Promise<TicketRow[]> {
    const result = await client.query<TicketRow>(
      `SELECT id AS ticket_id, booking_id, customer_id, showtime_id, branch_id, seat_id,
              ticket_code, qr_token_ciphertext, qr_token_nonce, qr_token_auth_tag,
              status, issued_at
       FROM tickets
       WHERE customer_id = $1
       ORDER BY issued_at DESC, id DESC`,
      [customerId],
    );
    return result.rows;
  }
}
