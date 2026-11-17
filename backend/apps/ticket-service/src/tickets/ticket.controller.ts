import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { principalFromHeaders } from '../common/principal';
import { TicketService } from './ticket.service';
import { CheckInResponse, ReverseCheckInResponse, TicketResponse } from './ticket.types';

type CheckInBody = {
  qrToken: string;
  showtimeId: string;
  branchId: string;
};

type ReverseCheckInBody = {
  reason: string;
  branchId: string;
};

@Controller('tickets')
export class TicketController {
  constructor(private readonly service: TicketService) {}

  @Get()
  list(@Req() request: Request): Promise<TicketResponse[]> {
    return this.service.listForCustomer(principalFromHeaders(request.headers));
  }

  @Post('check-ins')
  checkIn(
    @Body() body: CheckInBody,
    @Headers('x-correlation-id') correlationId: string,
    @Req() request: Request,
  ): Promise<CheckInResponse> {
    return this.service.checkIn(
      { ...body, correlationId: correlationId || 'ticket-check-in' },
      principalFromHeaders(request.headers),
    );
  }

  @Post('check-ins/:checkInId/reverse')
  reverse(
    @Param('checkInId') checkInId: string,
    @Body() body: ReverseCheckInBody,
    @Headers('x-correlation-id') correlationId: string,
    @Req() request: Request,
  ): Promise<ReverseCheckInResponse> {
    return this.service.reverseCheckIn(
      checkInId,
      body.reason,
      body.branchId,
      correlationId || 'ticket-check-in-reversal',
      principalFromHeaders(request.headers),
    );
  }
}
