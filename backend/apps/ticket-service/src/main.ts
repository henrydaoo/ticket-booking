import 'reflect-metadata';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { TICKET_CONFIG, TicketConfig } from './config';
import { correlationIdMiddleware } from './correlation-id.middleware';
import { TicketModule } from './ticket.module';
import {
  OBSERVABILITY,
  HttpMetricsInterceptor,
  PinoNestLogger,
  startTelemetry,
} from '@ticket-booking/observability';

loadDotenv({ path: join(__dirname, '../.env') });

async function bootstrap(): Promise<void> {
  const telemetry = startTelemetry('ticket-service');
  const app = await NestFactory.create(TicketModule, { logger: false });
  const observability = app.get(OBSERVABILITY);
  app.useLogger(new PinoNestLogger(observability.logger));
  app.useGlobalInterceptors(new HttpMetricsInterceptor(observability));
  const config = app.get(TICKET_CONFIG) as TicketConfig;
  app.use(correlationIdMiddleware);
  await app.listen(config.port);
  process.once('SIGTERM', () => void telemetry?.shutdown());
}

void bootstrap();

