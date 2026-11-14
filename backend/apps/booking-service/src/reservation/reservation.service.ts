import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';
import { CatalogClient } from '../catalog/catalog-client';
import { BOOKING_CONFIG, BookingConfig } from '../config';
import { TransactionRunner } from '../transaction.runner';
import { BookingPrincipal } from '../common/principal';
import { ReservationRepository } from './reservation.repository';
import { ReservationResponse } from './reservation.types';

@Injectable()
export class ReservationService {
  constructor(
    private readonly catalog: CatalogClient,
    private readonly transactions: TransactionRunner,
    private readonly repository: ReservationRepository,
    @Inject(BOOKING_CONFIG) private readonly config: BookingConfig,
  ) {}

  async getSeatMap(showtimeId: string, correlationId?: string): Promise<unknown> {
    const showtime = await this.catalog.getPublishedShowtime(showtimeId, correlationId);
    const seats = await this.repository.findSeatMap(showtimeId);
    if (seats.some((seat) => seat.priceVnd === null)) {
      throw new ConflictException('INVENTORY_NOT_READY');
    }
    if (seats.length === 0) {
      throw new ConflictException('INVENTORY_NOT_READY');
    }
    const pricedSeats = seats.map((seat) => {
      const priceVnd = showtime.prices?.[seat.type];
      if (!Number.isInteger(priceVnd) || (priceVnd as number) < 0) {
        throw new ConflictException('PRICE_NOT_AVAILABLE');
      }
      return { ...seat, priceVnd };
    });
    return {
      showtimeId,
      inventoryReady: true,
      reservationCutoffAt: showtime.reservationCutoffAt,
      seats: pricedSeats,
    };
  }

  async create(
    principal: BookingPrincipal,
    input: { showtimeId: string; seatIds: string[]; idempotencyKey: string },
    correlationId?: string,
  ): Promise<ReservationResponse> {
    this.validateInput(input);
    const showtime = await this.catalog.getPublishedShowtime(input.showtimeId, correlationId);
    if (!showtime.bookingEligible) {
      throw new ConflictException('SHOWTIME_NOT_BOOKABLE');
    }
    const expiresAt = new Date(Date.now() + this.config.reservationDurationSeconds * 1000);
    return this.transactions.run(async (client) => {
      const existing = await this.repository.findByIdempotencyKey(
        client,
        principal.userId,
        input.idempotencyKey,
      );
      if (existing) {
        if (
          existing.showtimeId !== input.showtimeId ||
          existing.seatIds.join(',') !== [...input.seatIds].sort().join(',')
        ) {
          throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
        }
        return existing;
      }
      try {
        return await this.repository.createReservation(client, {
          reservationId: randomUUID(),
          customerId: principal.userId,
          showtimeId: input.showtimeId,
          seatIds: input.seatIds,
          idempotencyKey: input.idempotencyKey,
          expiresAt,
          prices: showtime.prices ?? {},
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'SEAT_NOT_FOUND') {
          throw new NotFoundException('SEAT_NOT_FOUND');
        }
        if (error instanceof Error && error.message === 'SEAT_UNAVAILABLE') {
          throw new ConflictException('SEAT_UNAVAILABLE');
        }
        if (error instanceof Error && error.message === 'PRICE_UNAVAILABLE') {
          throw new ConflictException('PRICE_NOT_AVAILABLE');
        }
        throw error;
      }
    });
  }

  async cancel(principal: BookingPrincipal, reservationId: string): Promise<ReservationResponse> {
    try {
      return await this.transactions.run((client) =>
        this.repository.cancelReservation(client, reservationId, principal.userId),
      );
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (error.message === 'RESERVATION_NOT_FOUND') throw new NotFoundException('RESERVATION_NOT_FOUND');
      if (error.message === 'RESERVATION_FORBIDDEN') throw new ConflictException('RESERVATION_FORBIDDEN');
      if (error.message === 'RESERVATION_NOT_ACTIVE') throw new ConflictException('RESERVATION_NOT_ACTIVE');
      throw error;
    }
  }

  private validateInput(input: { showtimeId: string; seatIds: string[]; idempotencyKey: string }): void {
    if (!input.showtimeId || !Array.isArray(input.seatIds) || input.seatIds.length === 0) {
      throw new BadRequestException('showtimeId and at least one seatId are required');
    }
    if (new Set(input.seatIds).size !== input.seatIds.length) {
      throw new BadRequestException('seatIds must be unique');
    }
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(input.showtimeId) || input.seatIds.some((seatId) => !uuidPattern.test(seatId))) {
      throw new BadRequestException('showtimeId and seatIds must be UUIDs');
    }
    if (!input.idempotencyKey || input.idempotencyKey.length > 200) {
      throw new BadRequestException('idempotencyKey is required and must be at most 200 characters');
    }
  }
}
