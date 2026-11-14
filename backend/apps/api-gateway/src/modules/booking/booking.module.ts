import { Module } from '@nestjs/common';
import { GatewayConfigModule } from '../../config.module';
import { AuthModule } from '../auth/auth.module';
import { BookingController } from './booking.controller';
import { BookingProxy } from './booking.proxy';

@Module({
  imports: [GatewayConfigModule, AuthModule],
  controllers: [BookingController],
  providers: [BookingProxy],
})
export class BookingModule {}
