import { Module } from '@nestjs/common';
import { GatewayConfigModule } from './config.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { BookingModule } from './modules/booking/booking.module';
import { HealthController } from './health.controller';

@Module({
  imports: [GatewayConfigModule, AuthModule, CatalogModule, BookingModule],
  controllers: [HealthController],
})
export class AppModule {}
