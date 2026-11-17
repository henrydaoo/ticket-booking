import 'reflect-metadata';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { correlationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { IdentityModule } from './app.module';
import { IDENTITY_CONFIG, loadIdentityConfig } from './config/config';
import {
  OBSERVABILITY,
  HttpMetricsInterceptor,
  PinoNestLogger,
  startTelemetry,
} from '@ticket-booking/observability';

loadDotenv({ path: join(__dirname, '../.env') });

async function bootstrap(): Promise<void> {
  const telemetry = startTelemetry('identity-service');
  const app = await NestFactory.create(IdentityModule, {
    logger: false,
  });
  const observability = app.get(OBSERVABILITY);
  app.useLogger(new PinoNestLogger(observability.logger));
  app.useGlobalInterceptors(new HttpMetricsInterceptor(observability));
  const config = app.get(IDENTITY_CONFIG) as ReturnType<typeof loadIdentityConfig>;

  app.use(correlationIdMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  await app.listen(config.port);
  process.once('SIGTERM', () => void telemetry?.shutdown());
}

void bootstrap();

