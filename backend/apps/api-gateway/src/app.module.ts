import { Module } from '@nestjs/common';
import { GatewayConfigModule } from './config.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { BookingModule } from './modules/booking/booking.module';
import { PaymentModule } from './modules/payment/payment.module';
import { HealthController } from './health.controller';

@Module({
  imports: [GatewayConfigModule, AuthModule, CatalogModule, BookingModule, PaymentModule],
  controllers: [HealthController],
})
export class AppModule {}
