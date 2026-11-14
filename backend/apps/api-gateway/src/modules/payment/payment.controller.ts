import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CORRELATION_ID_HEADER } from '../../correlation-id.middleware';
import { AuthGuard, principalFromRequest } from '../auth/auth.guard';
import { PaymentProxy } from './payment.proxy';

@Controller('payment')
@UseGuards(AuthGuard)
export class PaymentController {
  constructor(private readonly proxy: PaymentProxy) {}

  @Post('payments')
  create(
    @Req() request: Request,
    @Headers(CORRELATION_ID_HEADER) correlationId: string | undefined,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.proxy.create(correlationId, principalFromRequest(request), body);
  }
}
