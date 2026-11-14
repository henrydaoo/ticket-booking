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
import { BookingInventoryRepository } from './inventory/booking-inventory.repository';
import { InventoryInitializer } from './inventory/inventory-initializer';
import { ReservationController } from './reservation/reservation.controller';
import { ReservationRepository } from './reservation/reservation.repository';
import { ReservationService } from './reservation/reservation.service';
import { CatalogClient } from './catalog/catalog-client';
import { BookingController } from './booking/booking.controller';
import { BookingRepository } from './booking/booking.repository';
import { BookingService } from './booking/booking.service';
import { PaymentOrchestrator } from './booking/payment-orchestrator';
import { BookingOutboxLifecycle } from './booking/outbox.lifecycle';

loadDotenv({ path: join(__dirname, '../.env') });

@Module({
  controllers: [HealthController, ReservationController, BookingController],
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
    BookingInventoryRepository,
    InventoryInitializer,
    CatalogClient,
    ReservationRepository,
    ReservationService,
    BookingRepository,
    BookingService,
    PaymentOrchestrator,
    BookingOutboxLifecycle,
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

