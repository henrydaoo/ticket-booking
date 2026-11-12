import 'reflect-metadata';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { Pool } from 'pg';
import { AuthController } from './auth.controller';
import { correlationIdMiddleware } from './correlation-id.middleware';
import { HealthController } from './health.controller';
import { JwksController } from './jwks.controller';
import { IDENTITY_CONFIG, loadIdentityConfig } from './config';

loadDotenv({ path: join(__dirname, '../.env') });

@Module({
  controllers: [AuthController, HealthController, JwksController],
  providers: [
    {
      provide: IDENTITY_CONFIG,
      useFactory: loadIdentityConfig,
    },
    {
      provide: Pool,
      useFactory: (config: ReturnType<typeof loadIdentityConfig>) =>
        new Pool({ connectionString: config.databaseUrl }),
      inject: [IDENTITY_CONFIG],
    },
  ],
})
class IdentityModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(IdentityModule, {
    logger: ['log', 'warn', 'error'],
  });
  const config = app.get(IDENTITY_CONFIG) as ReturnType<typeof loadIdentityConfig>;

  app.use(correlationIdMiddleware);
  await app.listen(config.port);
}

void bootstrap();

