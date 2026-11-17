import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { CheckInResponse, ReverseCheckInResponse } from './ticket.types';

export type CheckInTicketRow = {
  ticket_id: string;
  booking_id: string;
  showtime_id: string;
  branch_id: string | null;
  status: 'VALID' | 'USED' | 'CANCELLED';
};

export type CheckInRequest = {
  qrTokenDigest: string;
  showtimeId: string;
  branchId: string;
  actorId: string;
  correlationId: string;
};

@Injectable()
export class CheckInRepository {
  async findTicketForUpdate(
    client: PoolClient,
    qrTokenDigest: string,
  ): Promise<CheckInTicketRow | null> {
    const result = await client.query<CheckInTicketRow>(
      `SELECT id AS ticket_id, booking_id, showtime_id, branch_id, status
       FROM tickets
       WHERE qr_token_digest = $1
       FOR UPDATE`,
      [qrTokenDigest],
    );
    return result.rows[0] ?? null;
  }

  async createCheckIn(
    client: PoolClient,
    ticket: CheckInTicketRow,
    input: CheckInRequest,
  ): Promise<CheckInResponse> {
    const checkedIn = await client.query<{
      id: string;
      checked_in_at: Date;
    }>(
      `INSERT INTO ticket_check_ins
         (ticket_id, actor_id, branch_id, showtime_id, correlation_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, checked_in_at`,
      [
        ticket.ticket_id,
        input.actorId,
        input.branchId,
        input.showtimeId,
        input.correlationId,
      ],
    );
    await client.query(
      `UPDATE tickets
       SET status = 'USED'
       WHERE id = $1 AND status = 'VALID'`,
      [ticket.ticket_id],
    );
    await this.insertAudit(client, {
      action: 'CHECK_IN',
      actorId: input.actorId,
      ticketId: ticket.ticket_id,
      branchId: input.branchId,
      correlationId: input.correlationId,
      metadata: { showtimeId: input.showtimeId, checkInId: checkedIn.rows[0].id },
    });
    await this.insertOutbox(client, {
      eventId: `${checkedIn.rows[0].id}:TicketCheckedIn`,
      eventType: 'TicketCheckedIn',
      aggregateId: ticket.ticket_id,
      correlationId: input.correlationId,
      payload: {
        ticketId: ticket.ticket_id,
        bookingId: ticket.booking_id,
        showtimeId: ticket.showtime_id,
        branchId: input.branchId,
        checkInId: checkedIn.rows[0].id,
      },
    });
    return {
      checkInId: checkedIn.rows[0].id,
      ticketId: ticket.ticket_id,
      bookingId: ticket.booking_id,
      showtimeId: ticket.showtime_id,
      branchId: input.branchId,
      status: 'USED',
      checkedInAt: checkedIn.rows[0].checked_in_at.toISOString(),
    };
  }

  async findCheckInForUpdate(client: PoolClient, checkInId: string): Promise<{
    checkInId: string;
    ticketId: string;
    bookingId: string;
    status: 'VALID' | 'USED' | 'CANCELLED';
    branchId: string;
  } | null> {
    const result = await client.query(
      `SELECT ci.id AS "checkInId", t.id AS "ticketId", t.booking_id AS "bookingId",
              t.status, ci.branch_id AS "branchId"
       FROM ticket_check_ins ci
       JOIN tickets t ON t.id = ci.ticket_id
       WHERE ci.id = $1
       FOR UPDATE OF ci, t`,
      [checkInId],
    );
    return result.rows[0] ?? null;
  }

  async reverseCheckIn(
    client: PoolClient,
    checkIn: {
      checkInId: string;
      ticketId: string;
      bookingId: string;
      branchId: string;
    },
    actorId: string,
    reason: string,
    correlationId: string,
  ): Promise<ReverseCheckInResponse> {
    const reversedAt = new Date();
    await client.query(
      `UPDATE tickets SET status = 'VALID' WHERE id = $1 AND status = 'USED'`,
      [checkIn.ticketId],
    );
    await client.query(
      `UPDATE ticket_check_ins
       SET reversed_at = $2, reversed_by = $3, reversal_reason = $4
       WHERE id = $1 AND reversed_at IS NULL`,
      [checkIn.checkInId, reversedAt, actorId, reason],
    );
    await this.insertAudit(client, {
      action: 'CHECK_IN_REVERSED',
      actorId,
      ticketId: checkIn.ticketId,
      branchId: checkIn.branchId,
      correlationId,
      metadata: { checkInId: checkIn.checkInId, reason },
    });
    await this.insertOutbox(client, {
      eventId: `${checkIn.checkInId}:TicketCheckInReversed:${reversedAt.toISOString()}`,
      eventType: 'TicketCheckInReversed',
      aggregateId: checkIn.ticketId,
      correlationId,
      payload: {
        ticketId: checkIn.ticketId,
        bookingId: checkIn.bookingId,
        checkInId: checkIn.checkInId,
        branchId: checkIn.branchId,
        reason,
      },
    });
    return {
      checkInId: checkIn.checkInId,
      ticketId: checkIn.ticketId,
      status: 'VALID',
      reversedAt: reversedAt.toISOString(),
    };
  }

  private async insertAudit(
    client: PoolClient,
    input: {
      action: string;
      actorId: string;
      ticketId: string;
      branchId: string;
      correlationId: string;
      metadata: Record<string, string>;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO ticket_audit_records
         (action, actor_id, ticket_id, branch_id, correlation_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        input.action,
        input.actorId,
        input.ticketId,
        input.branchId,
        input.correlationId,
        JSON.stringify(input.metadata),
      ],
    );
  }

  private async insertOutbox(
    client: PoolClient,
    event: {
      eventId: string;
      eventType: string;
      aggregateId: string;
      correlationId: string;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO ticket_outbox_events
         (event_id, event_type, aggregate_id, correlation_id, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (event_id) DO NOTHING`,
      [
        event.eventId,
        event.eventType,
        event.aggregateId,
        event.correlationId,
        JSON.stringify({
          eventId: event.eventId,
          eventType: event.eventType,
          schemaVersion: 1,
          aggregateType: 'Ticket',
          aggregateId: event.aggregateId,
          occurredAt: new Date().toISOString(),
          correlationId: event.correlationId,
          payload: event.payload,
        }),
      ],
    );
  }
}
