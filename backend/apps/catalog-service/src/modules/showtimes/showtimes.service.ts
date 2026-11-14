import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CatalogPrincipal, requireCatalogManager } from '../../common/principal';
import { withCatalogConflictMapping } from '../../common/catalog-conflict';
import { ScreensService } from '../screens/screens.service';
import { CreateShowtimeDto, PublishShowtimeDto, ShowtimeQueryDto, UpdateDraftShowtimeDto } from './dto/showtime.dto';
import { ShowtimesRepository } from './showtimes.repository';
import { isShowtimeBookingEligible } from './showtime-eligibility';
import { ShowtimeResponse } from './showtime.types';

@Injectable()
export class ShowtimesService {
  constructor(private readonly repository: ShowtimesRepository, private readonly screens: ScreensService) {}

  async createShowtime(
    principal: CatalogPrincipal,
    input: CreateShowtimeDto,
  ): Promise<ShowtimeResponse> {
    await this.screens.requireScreenManager(principal, input.screenId);
    const startAt = new Date(input.startAt);
    const endAt = new Date(input.endAt);
    this.assertValidShowtimeRange(startAt, endAt);
    return withCatalogConflictMapping(async () => {
      const showtime = await this.repository.createShowtime({
        id: randomUUID(),
        movieId: input.movieId,
        screenId: input.screenId,
        startAt,
        endAt,
        saleOpensAt: input.saleOpensAt ? new Date(input.saleOpensAt) : null,
      });
      if (!showtime) {
        throw new NotFoundException('Screen not found');
      }
      return this.toShowtimeResponse(showtime, new Date());
    });
  }

  async updateDraftShowtime(
    principal: CatalogPrincipal,
    showtimeId: string,
    input: UpdateDraftShowtimeDto,
  ): Promise<ShowtimeResponse> {
    const current = await this.repository.findShowtime(showtimeId);
    if (!current) {
      throw new NotFoundException('Showtime not found');
    }
    requireCatalogManager(principal, current.branch_id);
    if (Object.values(input).every((value) => value === undefined)) {
      throw new BadRequestException('At least one draft showtime field is required');
    }
    const startAt = input.startAt ? new Date(input.startAt) : current.start_at;
    const endAt = input.endAt ? new Date(input.endAt) : current.end_at;
    this.assertValidShowtimeRange(startAt, endAt);
    return withCatalogConflictMapping(async () => {
      const showtime = await this.repository.updateDraftShowtime(showtimeId, input);
      if (!showtime) {
        throw new NotFoundException('Showtime not found');
      }
      return this.toShowtimeResponse(showtime, new Date());
    });
  }

  async publishShowtime(
    principal: CatalogPrincipal,
    showtimeId: string,
    input: PublishShowtimeDto,
    correlationId: string,
  ): Promise<ShowtimeResponse> {
    const current = await this.repository.findShowtime(showtimeId);
    if (!current) {
      throw new NotFoundException('Showtime not found');
    }
    requireCatalogManager(principal, current.branch_id);
    const occurredAt = new Date();
    return withCatalogConflictMapping(async () => {
      const showtime = await this.repository.publishShowtime({
        showtimeId,
        eventId: randomUUID(),
        correlationId,
        occurredAt,
        saleOpensAt: input.saleOpensAt ? new Date(input.saleOpensAt) : undefined,
      });
      if (!showtime) {
        throw new NotFoundException('Showtime not found');
      }
      return this.toShowtimeResponse(showtime, occurredAt);
    });
  }

  async listShowtimes(
    filter: ShowtimeQueryDto,
    now = new Date(),
  ): Promise<ShowtimeResponse[]> {
    if (filter.from && filter.to && new Date(filter.from) >= new Date(filter.to)) {
      throw new BadRequestException('The showtime range start must be before its end');
    }
    const showtimes = await this.repository.listPublishedShowtimes(filter);
    return showtimes.map((showtime) => this.toShowtimeResponse(showtime, now));
  }

  async listDraftShowtimes(
    principal: CatalogPrincipal,
  ): Promise<ShowtimeResponse[]> {
    requireCatalogManager(principal);
    const branchIds = principal.roles.includes('PLATFORM_ADMIN')
      ? undefined
      : principal.branchIds;
    const showtimes = await this.repository.listDraftShowtimes(branchIds);
    return showtimes.map((showtime) => this.toShowtimeResponse(showtime, new Date()));
  }

  async getPublishedShowtime(showtimeId: string): Promise<ShowtimeResponse> {
    const showtime = await this.repository.findPublishedShowtime(showtimeId);
    if (!showtime) {
      throw new NotFoundException('Showtime not found');
    }
    return this.toShowtimeResponse(showtime, new Date());
  }

  private assertValidShowtimeRange(startAt: Date, endAt: Date): void {
    if (
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      endAt.getTime() <= startAt.getTime()
    ) {
      throw new BadRequestException('Showtime end must be later than its start');
    }
  }

  private toShowtimeResponse(
    showtime: NonNullable<Awaited<ReturnType<ShowtimesRepository['findShowtime']>>>,
    now: Date,
  ): ShowtimeResponse {
    const startAt = new Date(showtime.start_at);
    const saleOpensAt = showtime.sale_opens_at
      ? new Date(showtime.sale_opens_at)
      : null;
    return {
      id: showtime.id,
      movieId: showtime.movie_id,
      movieStatus: showtime.movie_status,
      branchId: showtime.branch_id,
      screenId: showtime.screen_id,
      startAt: startAt.toISOString(),
      endAt: new Date(showtime.end_at).toISOString(),
      saleOpensAt: saleOpensAt?.toISOString() ?? null,
      reservationCutoffAt: new Date(
        startAt.getTime() - 15 * 60 * 1000,
      ).toISOString(),
      status: showtime.status,
      discoveryVisible: showtime.status === 'PUBLISHED',
      bookingEligible: saleOpensAt
        ? isShowtimeBookingEligible({
            status: showtime.status,
            movieStatus: showtime.movie_status,
            saleOpensAt,
            startAt,
            now,
          })
        : false,
      prices: showtime.prices,
      pricingVersion: showtime.pricing_version,
      layoutVersion: showtime.layout_version,
      seats: showtime.seats,
    };
  }
}
