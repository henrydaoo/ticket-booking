import 'reflect-metadata';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { TICKET_CONFIG, TicketConfig } from './config';
import { correlationIdMiddleware } from './correlation-id.middleware';
import { TicketModule } from './ticket.module';

loadDotenv({ path: join(__dirname, '../.env') });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(TicketModule, { logger: ['log', 'warn', 'error'] });
  const config = app.get(TICKET_CONFIG) as TicketConfig;
  app.use(correlationIdMiddleware);
  await app.listen(config.port);
}

void bootstrap();

