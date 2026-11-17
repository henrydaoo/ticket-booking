import 'reflect-metadata';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { Kafka } from 'kafkajs';
import { KafkaDeadLetterPublisher } from '@ticket-booking/event-recovery';
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
import { BookingPaymentClient } from './booking/payment-client';
import { BookingOutboxLifecycle } from './booking/outbox.lifecycle';
import {
  OBSERVABILITY,
  HttpMetricsInterceptor,
  ObservabilityMetricsController,
  PinoNestLogger,
  createObservability,
  startTelemetry,
} from '@ticket-booking/observability';

loadDotenv({ path: join(__dirname, '../.env') });

@Module({
  controllers: [
    HealthController,
    ReservationController,
    BookingController,
    ObservabilityMetricsController,
  ],
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
          ...config.kafkaSecurity,
        }),
      inject: [BOOKING_CONFIG],
    },
    {
      provide: KafkaDeadLetterPublisher,
      useFactory: (kafka: Kafka) => new KafkaDeadLetterPublisher(kafka, 'booking-service'),
      inject: [Kafka],
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
    BookingPaymentClient,
    BookingOutboxLifecycle,
    KafkaConsumerLifecycle,
    BookingWorkerLifecycle,
    {
      provide: OBSERVABILITY,
      useFactory: () => createObservability('booking-service'),
    },
  ],
})
class BookingModule {}

async function bootstrap(): Promise<void> {
  const telemetry = startTelemetry('booking-service');
  const app = await NestFactory.create(BookingModule, {
    logger: false,
  });
  const observability = app.get(OBSERVABILITY);
  app.useLogger(new PinoNestLogger(observability.logger));
  app.useGlobalInterceptors(new HttpMetricsInterceptor(observability));
  const config = app.get(BOOKING_CONFIG) as ReturnType<typeof loadBookingConfig>;

  app.use(correlationIdMiddleware);
  await app.listen(config.port);
  process.once('SIGTERM', () => void telemetry?.shutdown());
}

void bootstrap();

