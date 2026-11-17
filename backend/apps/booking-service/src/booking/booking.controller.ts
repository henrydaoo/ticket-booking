import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { principalFromHeaders } from '../common/principal';
import { BookingService } from './booking.service';

@Controller('bookings')
export class BookingController {
  constructor(private readonly service: BookingService) {}

  @Get()
  list(@Req() request: Request): Promise<unknown> {
    return this.service.list(principalFromHeaders(request.headers));
  }

  @Get(':bookingId')
  findOne(
    @Req() request: Request,
    @Param('bookingId') bookingId: string,
  ): Promise<unknown> {
    return this.service.findOne(principalFromHeaders(request.headers), bookingId);
  }

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

  @Post(':bookingId/payment')
  initiatePayment(
    @Req() request: Request,
    @Param('bookingId') bookingId: string,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Body() body: { idempotencyKey: string },
  ): Promise<unknown> {
    return this.service.initiatePayment(
      principalFromHeaders(request.headers),
      bookingId,
      body.idempotencyKey,
      correlationId,
      request.ip || '127.0.0.1',
    );
  }
}
