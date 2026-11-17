import { Module } from '@nestjs/common';
import { GatewayConfigModule } from '../../config.module';
import { AuthModule } from '../auth/auth.module';
import { TicketController } from './ticket.controller';
import { TicketProxy } from './ticket.proxy';

@Module({
  imports: [GatewayConfigModule, AuthModule],
  controllers: [TicketController],
  providers: [TicketProxy],
})
export class TicketModule {}
