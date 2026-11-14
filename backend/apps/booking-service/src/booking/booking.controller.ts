import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { principalFromHeaders } from '../common/principal';
import { BookingService } from './booking.service';

@Controller('bookings')
export class BookingController {
  constructor(private readonly service: BookingService) {}

  @Get(':bookingId/payment-context')
  paymentContext(
    @Req() request: Request,
    @Param('bookingId') bookingId: string,
  ): Promise<unknown> {
    return this.service.paymentContext(principalFromHeaders(request.headers), bookingId);
  }

  @Post()
  create(
    @Req() request: Request,
    @Body() body: { reservationId: string; idempotencyKey: string },
  ): Promise<unknown> {
    return this.service.create(principalFromHeaders(request.headers), body);
  }
}
