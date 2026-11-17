import 'reflect-metadata';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { AppModule } from './app.module';
import { GATEWAY_CONFIG } from './config';
import { correlationIdMiddleware } from './correlation-id.middleware';
import {
  OBSERVABILITY,
  HttpMetricsInterceptor,
  PinoNestLogger,
  startTelemetry,
} from '@ticket-booking/observability';

loadDotenv({ path: join(__dirname, '../.env') });

async function bootstrap(): Promise<void> {
  const telemetry = startTelemetry('api-gateway');
  const app = await NestFactory.create(AppModule, { logger: false });
  const observability = app.get(OBSERVABILITY);
  app.useLogger(new PinoNestLogger(observability.logger));
  app.useGlobalInterceptors(new HttpMetricsInterceptor(observability));
  const config = app.get(GATEWAY_CONFIG);

  app.enableCors({
    origin: config.corsOrigins,
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Correlation-Id'],
  });
  app.use(correlationIdMiddleware);
  await app.listen(config.port);
  process.once('SIGTERM', () => void telemetry?.shutdown());
}

void bootstrap();

