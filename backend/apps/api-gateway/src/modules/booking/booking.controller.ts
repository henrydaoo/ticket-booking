import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CORRELATION_ID_HEADER } from '../../correlation-id.middleware';
import { AuthGuard, principalFromRequest } from '../auth/auth.guard';
import { BookingProxy } from './booking.proxy';

@Controller('booking')
@UseGuards(AuthGuard)
export class BookingController {
  constructor(private readonly proxy: BookingProxy) {}

  @Get('bookings')
  listBookings(
    @Req() request: Request,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.forward(
      '/bookings',
      'GET',
      correlationId,
      principalFromRequest(request),
    );
  }

  @Get('bookings/:bookingId')
  getBooking(
    @Req() request: Request,
    @Param('bookingId') bookingId: string,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.forward(
      `/bookings/${encodeURIComponent(bookingId)}`,
      'GET',
      correlationId,
      principalFromRequest(request),
    );
  }

  @Get('showtimes/:showtimeId/seats')
  seats(
    @Req() request: Request,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.forward(
      `/showtimes/${encodeURIComponent(String(request.params.showtimeId))}/seats`,
      'GET',
      correlationId,
      principalFromRequest(request),
    );
  }

  @Post('reservations')
  reserve(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.forward(
      '/reservations',
      'POST',
      correlationId,
      principalFromRequest(request),
      body,
    );
  }

  @Post('reservations/:reservationId/cancel')
  cancel(
    @Req() request: Request,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.forward(
      `/reservations/${encodeURIComponent(String(request.params.reservationId))}/cancel`,
      'POST',
      correlationId,
      principalFromRequest(request),
    );
  }

  @Post('bookings')
  createBooking(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.forward(
      '/bookings',
      'POST',
      correlationId,
      principalFromRequest(request),
      body,
    );
  }
}
