import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { TICKET_CONFIG, TicketConfig } from '../config';
import { decryptQrToken, digestQrToken, encryptQrToken } from '../qr-token-cipher';
import { TicketPrincipal } from '../common/principal';
import { TicketTransactionRunner } from '../transaction.runner';
import { TicketRepository } from './ticket.repository';
import {
  BookingConfirmedEvent,
  NewTicket,
  TicketResponse,
  TicketRow,
  CheckInResponse,
  ReverseCheckInResponse,
} from './ticket.types';
import { CheckInRepository } from './check-in.repository';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > 200) {
    throw new BadRequestException(`INVALID_BOOKING_CONFIRMED:${field}`);
  }
  return value.trim();
}

function requiredInputString(value: unknown, code: string, maxLength = 200): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maxLength) {
    throw new BadRequestException(code);
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
  const branchId = requiredString(value.payload.branchId, 'payload.branchId');
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
      branchId,
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
    @Optional() private readonly checkIns?: CheckInRepository,
  ) {}

  async processBookingConfirmed(value: unknown): Promise<void> {
    const event = parseBookingConfirmedEvent(value);
    const newTickets: NewTicket[] = event.payload.seats.map(({ seat_id: seatId }) => {
      const qrToken = randomBytes(32).toString('base64url');
      const encrypted = encryptQrToken(
        qrToken,
        this.config.qrTokenEncryptionKey,
      );
      return {
        ticketId: randomUUID(),
        bookingId: event.payload.bookingId,
        customerId: event.payload.customerId,
        showtimeId: event.payload.showtimeId,
        branchId: event.payload.branchId,
        seatId,
        ticketCode: randomBytes(9).toString('hex').toUpperCase(),
        qrTokenCiphertext: encrypted.ciphertext,
        qrTokenNonce: encrypted.nonce,
        qrTokenAuthTag: encrypted.authTag,
        qrTokenDigest: digestQrToken(qrToken),
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

  async checkIn(
    input: { qrToken: string; showtimeId: string; branchId: string; correlationId: string },
    principal: TicketPrincipal,
  ): Promise<CheckInResponse> {
    const qrToken = requiredInputString(input.qrToken, 'QR_TOKEN_REQUIRED', 4096);
    const showtimeId = requiredInputString(input.showtimeId, 'SHOWTIME_ID_REQUIRED');
    const branchId = requiredInputString(input.branchId, 'BRANCH_ID_REQUIRED');
    this.assertCheckInRole(principal);
    this.assertBranch(principal, branchId);
    if (!this.checkIns) throw new Error('CHECK_IN_REPOSITORY_UNAVAILABLE');
    const checkIns = this.checkIns;
    return this.transactions.run(async (client) => {
      const ticket = await checkIns.findTicketForUpdate(
        client,
        digestQrToken(qrToken),
      );
      if (!ticket) throw new NotFoundException('TICKET_NOT_FOUND');
      if (ticket.showtime_id !== showtimeId) {
        throw new ConflictException('TICKET_SHOWTIME_MISMATCH');
      }
      if (ticket.branch_id !== branchId) {
        throw new ForbiddenException('TICKET_BRANCH_FORBIDDEN');
      }
      if (ticket.status !== 'VALID') {
        throw new ConflictException(`TICKET_${ticket.status}`);
      }
      return checkIns.createCheckIn(client, ticket, {
        qrTokenDigest: digestQrToken(qrToken),
        showtimeId,
        branchId,
        actorId: principal.userId,
        correlationId: input.correlationId,
      });
    });
  }

  async reverseCheckIn(
    checkInId: string,
    reason: string,
    branchId: string,
    correlationId: string,
    principal: TicketPrincipal,
  ): Promise<ReverseCheckInResponse> {
    const normalizedCheckInId = requiredInputString(checkInId, 'CHECK_IN_ID_REQUIRED');
    const normalizedBranchId = requiredInputString(branchId, 'BRANCH_ID_REQUIRED');
    const normalizedReason = requiredInputString(reason, 'REVERSAL_REASON_REQUIRED', 500);
    this.assertManagerOrAdmin(principal);
    this.assertBranch(principal, normalizedBranchId);
    if (!this.checkIns) throw new Error('CHECK_IN_REPOSITORY_UNAVAILABLE');
    const checkIns = this.checkIns;
    return this.transactions.run(async (client) => {
      const checkIn = await checkIns.findCheckInForUpdate(client, normalizedCheckInId);
      if (!checkIn) throw new NotFoundException('CHECK_IN_NOT_FOUND');
      if (checkIn.branchId !== normalizedBranchId) {
        throw new ForbiddenException('CHECK_IN_BRANCH_FORBIDDEN');
      }
      if (checkIn.status !== 'USED') {
        throw new ConflictException('CHECK_IN_ALREADY_REVERSED');
      }
      return checkIns.reverseCheckIn(
        client,
        checkIn,
        principal.userId,
        normalizedReason,
        correlationId,
      );
    });
  }

  private assertCheckInRole(principal: TicketPrincipal): void {
    if (
      !principal.roles.includes('CINEMA_STAFF') &&
      !principal.roles.includes('CINEMA_MANAGER') &&
      !principal.roles.includes('PLATFORM_ADMIN')
    ) {
      throw new ForbiddenException('CHECK_IN_ROLE_REQUIRED');
    }
    if (principal.roles.includes('PLATFORM_ADMIN') && !principal.mfaCompleted) {
      throw new ForbiddenException('PLATFORM_ADMIN_MFA_REQUIRED');
    }
  }

  private assertManagerOrAdmin(principal: TicketPrincipal): void {
    if (
      !principal.roles.includes('CINEMA_MANAGER') &&
      !principal.roles.includes('PLATFORM_ADMIN')
    ) {
      throw new ForbiddenException('CHECK_IN_REVERSAL_ROLE_REQUIRED');
    }
    if (principal.roles.includes('PLATFORM_ADMIN') && !principal.mfaCompleted) {
      throw new ForbiddenException('PLATFORM_ADMIN_MFA_REQUIRED');
    }
  }

  private assertBranch(principal: TicketPrincipal, branchId: string): void {
    if (!branchId || !principal.branchIds.includes(branchId)) {
      throw new ForbiddenException('BRANCH_CONTEXT_FORBIDDEN');
    }
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
