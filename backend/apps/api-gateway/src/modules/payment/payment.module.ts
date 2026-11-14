import { Module } from '@nestjs/common';
import { GatewayConfigModule } from '../../config.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentController } from './payment.controller';
import { PaymentProxy } from './payment.proxy';
import { PaymentWebhookController } from './payment-webhook.controller';

@Module({
  imports: [GatewayConfigModule, AuthModule],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [PaymentProxy],
})
export class PaymentModule {}
