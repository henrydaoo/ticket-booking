import 'reflect-metadata';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import { BOOKING_CONFIG, loadBookingConfig } from './config';
import { correlationIdMiddleware } from './correlation-id.middleware';
import { HealthController } from './health.controller';
import { KafkaConsumerLifecycle } from './kafka-consumer.lifecycle';
import { BookingWorkerLifecycle } from './worker.lifecycle';
import { TransactionRunner } from './transaction.runner';

loadDotenv({ path: join(__dirname, '../.env') });

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: BOOKING_CONFIG,
      useFactory: loadBookingConfig,
    },
    {
      provide: Pool,
      useFactory: (config: ReturnType<typeof loadBookingConfig>) =>
        new Pool({ connectionString: config.databaseUrl }),
      inject: [BOOKING_CONFIG],
    },
    {
      provide: Kafka,
      useFactory: (config: ReturnType<typeof loadBookingConfig>) =>
        new Kafka({
          clientId: config.kafkaClientId,
          brokers: config.kafkaBrokers,
        }),
      inject: [BOOKING_CONFIG],
    },
    TransactionRunner,
    KafkaConsumerLifecycle,
    BookingWorkerLifecycle,
  ],
})
class BookingModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(BookingModule, {
    logger: ['log', 'warn', 'error'],
  });
  const config = app.get(BOOKING_CONFIG) as ReturnType<typeof loadBookingConfig>;

  app.use(correlationIdMiddleware);
  await app.listen(config.port);
}

void bootstrap();

