import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { principalFromHeaders } from '../common/principal';
import { BookingService } from './booking.service';

@Controller('bookings')
export class BookingController {
  constructor(private readonly service: BookingService) {}

  @Post()
  create(
    @Req() request: Request,
    @Body() body: { reservationId: string; idempotencyKey: string },
  ): Promise<unknown> {
    return this.service.create(principalFromHeaders(request.headers), body);
  }
}
