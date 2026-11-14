import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { principalFromHeaders } from '../common/principal';
import { ReservationService } from './reservation.service';

@Controller()
export class ReservationController {
  constructor(private readonly service: ReservationService) {}

  @Get('showtimes/:showtimeId/seats')
  getSeatMap(
    @Param('showtimeId') showtimeId: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<unknown> {
    return this.service.getSeatMap(showtimeId, correlationId);
  }

  @Post('reservations')
  create(
    @Req() request: Request,
    @Body() body: { showtimeId: string; seatIds: string[]; idempotencyKey: string },
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<unknown> {
    return this.service.create(principalFromHeaders(request.headers), body, correlationId);
  }

  @Post('reservations/:reservationId/cancel')
  cancel(
    @Req() request: Request,
    @Param('reservationId') reservationId: string,
  ): Promise<unknown> {
    return this.service.cancel(principalFromHeaders(request.headers), reservationId);
  }
}
