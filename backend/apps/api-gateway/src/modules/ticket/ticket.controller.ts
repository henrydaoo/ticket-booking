import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CORRELATION_ID_HEADER } from '../../correlation-id.middleware';
import { AuthGuard, principalFromRequest } from '../auth/auth.guard';
import { TicketProxy } from './ticket.proxy';

@Controller('ticket')
@UseGuards(AuthGuard)
export class TicketController {
  constructor(private readonly proxy: TicketProxy) {}

  @Get('tickets')
  list(
    @Req() request: Request,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.list(correlationId, principalFromRequest(request));
  }

  @Post('check-ins')
  checkIn(
    @Body() body: { qrToken: string; showtimeId: string; branchId: string },
    @Req() request: Request,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.checkIn(correlationId, body, principalFromRequest(request));
  }

  @Post('check-ins/:checkInId/reverse')
  reverse(
    @Param('checkInId') checkInId: string,
    @Body() body: { reason: string; branchId: string },
    @Req() request: Request,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.reverse(
      checkInId,
      correlationId,
      body,
      principalFromRequest(request),
    );
  }
}
