import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { BOOKING_CONFIG, BookingConfig } from '../config';
import { BookingPrincipal } from '../common/principal';
import { TransactionRunner } from '../transaction.runner';
import { BookingRepository } from './booking.repository';
import { BookingResponse } from './booking.types';

@Injectable()
export class BookingService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly repository: BookingRepository,
    @Inject(BOOKING_CONFIG) private readonly config: BookingConfig,
  ) {}

  async create(
    principal: BookingPrincipal,
    input: { reservationId: string; idempotencyKey: string },
  ): Promise<BookingResponse> {
    if (!input.reservationId || !input.idempotencyKey || input.idempotencyKey.length > 200) {
      throw new BadRequestException('reservationId and idempotencyKey are required');
    }
    return this.transactions.run(async (client) => {
      const existing = await this.repository.findByIdempotencyKey(
        client,
        principal.userId,
        input.idempotencyKey,
      );
      if (existing) {
        if (existing.reservationId !== input.reservationId) {
          throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
        }
        return existing;
      }
      try {
        return await this.repository.createFromReservation(client, {
          bookingId: randomUUID(),
          customerId: principal.userId,
          reservationId: input.reservationId,
          idempotencyKey: input.idempotencyKey,
          paymentDeadlineAt: new Date(
            Date.now() + this.config.paymentProcessingDeadlineSeconds * 1000,
          ),
        });
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        if (error.message === 'RESERVATION_NOT_FOUND') {
          throw new NotFoundException('RESERVATION_NOT_FOUND');
        }
        if (error.message === 'RESERVATION_FORBIDDEN') {
          throw new ConflictException('RESERVATION_FORBIDDEN');
        }
        if (
          error.message === 'RESERVATION_NOT_ACTIVE' ||
          error.message === 'RESERVATION_EXPIRED'
        ) {
          throw new ConflictException(error.message);
        }
        throw error;
      }
    });
  }
}
