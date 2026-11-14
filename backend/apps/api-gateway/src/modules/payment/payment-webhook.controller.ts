import { Body, Controller, Headers, Post } from '@nestjs/common';
import { CORRELATION_ID_HEADER } from '../../correlation-id.middleware';
import { PaymentProxy } from './payment.proxy';

@Controller('payment/webhooks')
export class PaymentWebhookController {
  constructor(private readonly proxy: PaymentProxy) {}

  @Post('vnpay')
  webhook(
    @Headers(CORRELATION_ID_HEADER) correlationId: string | undefined,
    @Body() body: Record<string, string>,
  ): Promise<unknown> {
    return this.proxy.webhook(correlationId, body);
  }
}
