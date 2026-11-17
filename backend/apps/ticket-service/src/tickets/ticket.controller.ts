import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { principalFromHeaders } from '../common/principal';
import { TicketService } from './ticket.service';
import { TicketResponse } from './ticket.types';

@Controller('tickets')
export class TicketController {
  constructor(private readonly service: TicketService) {}

  @Get()
  list(@Req() request: Request): Promise<TicketResponse[]> {
    return this.service.listForCustomer(principalFromHeaders(request.headers));
  }
}
