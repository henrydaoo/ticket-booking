import { Module } from '@nestjs/common';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import {
  EMAIL_DELIVERY,
} from './modules/auth/ports/email-delivery.port';
import { IDENTITY_CONFIG, loadIdentityConfig } from './config/config';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { LocalEmailDeliveryAdapter } from './infrastructure/email/local-email-delivery.adapter';
import { SmtpEmailDeliveryAdapter } from './infrastructure/email/smtp-email-delivery.adapter';
import { IdentityRepository } from './modules/auth/auth.repository';
import { HealthModule } from './modules/health/health.module';
import { JwksController } from './modules/auth/jwks.controller';
import { JwtTokenService } from './modules/auth/jwt-token.service';
import { PasswordService } from './modules/auth/password.service';
import { TotpService } from './modules/auth/totp.service';
import { TransactionRunner } from './infrastructure/database/transaction.runner';

@Module({
  imports: [InfrastructureModule, HealthModule],
  controllers: [AuthController, JwksController],
  providers: [
    AuthService,
    IdentityRepository,
    JwtTokenService,
    PasswordService,
    TotpService,
    TransactionRunner,
    LocalEmailDeliveryAdapter,
    {
      provide: EMAIL_DELIVERY,
      inject: [IDENTITY_CONFIG, LocalEmailDeliveryAdapter],
      useFactory: (
        config: ReturnType<typeof loadIdentityConfig>,
        local: LocalEmailDeliveryAdapter,
      ) =>
        config.emailDeliveryMode === 'smtp'
          ? new SmtpEmailDeliveryAdapter(config)
          : local,
    },
  ],
})
export class IdentityModule {}
