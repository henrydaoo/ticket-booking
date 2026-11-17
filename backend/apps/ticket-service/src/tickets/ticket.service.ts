import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { TICKET_CONFIG, TicketConfig } from '../config';
import { decryptQrToken, encryptQrToken } from '../qr-token-cipher';
import { TicketPrincipal } from '../common/principal';
import { TicketTransactionRunner } from '../transaction.runner';
import { TicketRepository } from './ticket.repository';
import {
  BookingConfirmedEvent,
  NewTicket,
  TicketResponse,
  TicketRow,
} from './ticket.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 200) {
    throw new BadRequestException(`INVALID_BOOKING_CONFIRMED:${field}`);
  }
  return value.trim();
}

export function parseBookingConfirmedEvent(value: unknown): BookingConfirmedEvent {
  if (!isRecord(value) || !isRecord(value.payload)) {
    throw new BadRequestException('INVALID_BOOKING_CONFIRMED');
  }
  if (
    value.eventType !== 'BookingConfirmed' ||
    value.schemaVersion !== 1 ||
    value.aggregateType !== 'Booking'
  ) {
    throw new BadRequestException('UNSUPPORTED_BOOKING_CONFIRMED_EVENT');
  }
  const seats = value.payload.seats;
  if (!Array.isArray(seats) || seats.length === 0) {
    throw new BadRequestException('INVALID_BOOKING_CONFIRMED:seats');
  }
  const seatIds = seats.map((seat) => {
    if (!isRecord(seat)) throw new BadRequestException('INVALID_BOOKING_CONFIRMED:seats');
    return requiredString(seat.seat_id, 'seats.seat_id');
  });
  if (new Set(seatIds).size !== seatIds.length) {
    throw new BadRequestException('DUPLICATE_BOOKING_CONFIRMED_SEAT');
  }

  const occurredAt = requiredString(value.occurredAt, 'occurredAt');
  if (!Number.isFinite(Date.parse(occurredAt))) {
    throw new BadRequestException('INVALID_BOOKING_CONFIRMED:occurredAt');
  }
  const aggregateId = requiredString(value.aggregateId, 'aggregateId');
  const bookingId = requiredString(value.payload.bookingId, 'payload.bookingId');
  if (aggregateId !== bookingId) {
    throw new BadRequestException('BOOKING_CONFIRMED_AGGREGATE_MISMATCH');
  }

  return {
    eventId: requiredString(value.eventId, 'eventId'),
    eventType: 'BookingConfirmed',
    schemaVersion: 1,
    aggregateType: 'Booking',
    aggregateId,
    occurredAt,
    correlationId: requiredString(value.correlationId, 'correlationId'),
    payload: {
      bookingId,
      customerId: requiredString(value.payload.customerId, 'payload.customerId'),
      showtimeId: requiredString(value.payload.showtimeId, 'payload.showtimeId'),
      seats: seatIds.map((seat_id) => ({ seat_id })),
    },
  };
}

@Injectable()
export class TicketService {
  constructor(
    private readonly transactions: TicketTransactionRunner,
    private readonly repository: TicketRepository,
    @Inject(TICKET_CONFIG) private readonly config: TicketConfig,
  ) {}

  async processBookingConfirmed(value: unknown): Promise<void> {
    const event = parseBookingConfirmedEvent(value);
    const newTickets: NewTicket[] = event.payload.seats.map(({ seat_id: seatId }) => {
      const encrypted = encryptQrToken(
        randomBytes(32).toString('base64url'),
        this.config.qrTokenEncryptionKey,
      );
      return {
        ticketId: randomUUID(),
        bookingId: event.payload.bookingId,
        customerId: event.payload.customerId,
        showtimeId: event.payload.showtimeId,
        seatId,
        ticketCode: randomBytes(9).toString('hex').toUpperCase(),
        qrTokenCiphertext: encrypted.ciphertext,
        qrTokenNonce: encrypted.nonce,
        qrTokenAuthTag: encrypted.authTag,
      };
    });

    await this.transactions.run((client) =>
      this.repository.issueBookingConfirmed(client, event, newTickets),
    );
  }

  async listForCustomer(principal: TicketPrincipal): Promise<TicketResponse[]> {
    if (!principal.roles.includes('CUSTOMER')) {
      throw new ForbiddenException('CUSTOMER_ROLE_REQUIRED');
    }
    const rows = await this.transactions.run((client) =>
      this.repository.listByCustomer(client, principal.userId),
    );
    return rows.map((row) => this.toResponse(row));
  }

  private toResponse(row: TicketRow): TicketResponse {
    return {
      ticketId: row.ticket_id,
      bookingId: row.booking_id,
      showtimeId: row.showtime_id,
      seatId: row.seat_id,
      ticketCode: row.ticket_code,
      status: row.status,
      issuedAt: row.issued_at.toISOString(),
      qrToken:
        row.status === 'VALID'
          ? decryptQrToken(
              {
                ciphertext: row.qr_token_ciphertext,
                nonce: row.qr_token_nonce,
                authTag: row.qr_token_auth_tag,
              },
              this.config.qrTokenEncryptionKey,
            )
          : null,
    };
  }
}
