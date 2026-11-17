import { Controller, Get, Headers, Req, UseGuards } from '@nestjs/common';
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
}
