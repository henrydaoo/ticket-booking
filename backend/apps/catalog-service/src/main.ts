import 'reflect-metadata';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { CATALOG_CONFIG, loadCatalogConfig } from './config';
import { correlationIdMiddleware } from './correlation-id.middleware';
import { AppModule } from './app.module';
import {
  OBSERVABILITY,
  HttpMetricsInterceptor,
  PinoNestLogger,
  startTelemetry,
} from '@ticket-booking/observability';

loadDotenv({ path: join(__dirname, '../.env') });

async function bootstrap(): Promise<void> {
  const telemetry = startTelemetry('catalog-service');
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });
  const observability = app.get(OBSERVABILITY);
  app.useLogger(new PinoNestLogger(observability.logger));
  app.useGlobalInterceptors(new HttpMetricsInterceptor(observability));
  const config = app.get(CATALOG_CONFIG) as ReturnType<typeof loadCatalogConfig>;

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

