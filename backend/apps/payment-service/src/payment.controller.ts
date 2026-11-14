import { Body, Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CORRELATION_ID_HEADER } from './correlation-id.middleware';
import { principalFromHeaders } from './common/principal';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  @Post()
  create(
    @Req() request: Request,
    @Headers(CORRELATION_ID_HEADER) correlationId: string | undefined,
    @Body() body: { bookingId: string; idempotencyKey: string },
  ) {
    return this.service.create(
      principalFromHeaders(request.headers),
      body,
      correlationId,
      request.ip || '127.0.0.1',
    );
  }

  @Post('/webhooks/vnpay')
  @HttpCode(200)
  webhook(
    @Body() body: Record<string, string>,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    return this.service.processWebhook(body, correlationId || 'payment-webhook');
  }
}
