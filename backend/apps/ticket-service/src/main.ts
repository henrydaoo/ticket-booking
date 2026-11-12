import 'reflect-metadata';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import { TICKET_CONFIG, loadTicketConfig } from './config';
import { correlationIdMiddleware } from './correlation-id.middleware';
import { TicketConsumerLifecycle } from './consumer.lifecycle';
import { HealthController } from './health.controller';

loadDotenv({ path: join(__dirname, '../.env') });

@Module({
  controllers: [HealthController],
  providers: [
    { provide: TICKET_CONFIG, useFactory: loadTicketConfig },
    {
      provide: Pool,
      useFactory: (config: ReturnType<typeof loadTicketConfig>) =>
        new Pool({ connectionString: config.databaseUrl }),
      inject: [TICKET_CONFIG],
    },
    {
      provide: Kafka,
      useFactory: (config: ReturnType<typeof loadTicketConfig>) =>
        new Kafka({ clientId: config.kafkaClientId, brokers: config.kafkaBrokers }),
      inject: [TICKET_CONFIG],
    },
    TicketConsumerLifecycle,
  ],
})
class TicketModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(TicketModule, { logger: ['log', 'warn', 'error'] });
  const config = app.get(TICKET_CONFIG) as ReturnType<typeof loadTicketConfig>;
  app.use(correlationIdMiddleware);
  await app.listen(config.port);
}

void bootstrap();

