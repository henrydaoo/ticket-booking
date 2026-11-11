import 'reflect-metadata';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { config as loadDotenv } from 'dotenv';
import { AuthController } from './auth.controller';
import { CatalogController } from './catalog.controller';
import { GATEWAY_CONFIG, loadGatewayConfig } from './config';
import { correlationIdMiddleware } from './correlation-id.middleware';
import { HealthController } from './health.controller';

loadDotenv({ path: join(__dirname, '../.env') });

@Module({
  controllers: [AuthController, CatalogController, HealthController],
  providers: [
    {
      provide: GATEWAY_CONFIG,
      useFactory: loadGatewayConfig,
    },
  ],
})
class GatewayModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(GatewayModule, { logger: ['log', 'warn', 'error'] });
  const config = app.get(GATEWAY_CONFIG);

  app.use(correlationIdMiddleware);
  await app.listen(config.port);
}

void bootstrap();

