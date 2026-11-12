import { Controller, HttpCode, Post } from '@nestjs/common';

@Controller('webhooks')
export class ProviderController {
  @Post('payment')
  @HttpCode(501)
  paymentWebhookBoundary(): { statusCode: 501; message: string } {
    return {
      statusCode: 501,
      message: 'Payment provider webhook processing is deferred',
    };
  }
}

