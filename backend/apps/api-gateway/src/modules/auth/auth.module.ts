import { Module } from '@nestjs/common';
import { GatewayConfigModule } from '../../config.module';
import { RateLimitGuard } from '../../common/rate-limit.guard';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthProxy } from './auth.proxy';
import { JwksClientService } from './jwks-client.service';
import { JwtVerifierService } from './jwt-verifier.service';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [GatewayConfigModule],
  controllers: [AuthController],
  providers: [
    AuthProxy,
    AuthGuard,
    JwksClientService,
    JwtVerifierService,
    RolesGuard,
    RateLimitGuard,
  ],
  exports: [AuthGuard, RolesGuard, JwtVerifierService, JwksClientService],
})
export class AuthModule {}
