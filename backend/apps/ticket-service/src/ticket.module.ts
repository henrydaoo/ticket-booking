import { Module } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { KafkaDeadLetterPublisher } from '@ticket-booking/event-recovery';
import { Pool } from 'pg';
import { TICKET_CONFIG, loadTicketConfig } from './config';
import { TicketConsumerLifecycle } from './consumer.lifecycle';
import { HealthController } from './health.controller';
import { TicketOutboxLifecycle } from './tickets/ticket-outbox.lifecycle';
import { TicketController } from './tickets/ticket.controller';
import { TicketRepository } from './tickets/ticket.repository';
import { TicketService } from './tickets/ticket.service';
import { CheckInRepository } from './tickets/check-in.repository';
import { TicketTransactionRunner } from './transaction.runner';
import {
  OBSERVABILITY,
  ObservabilityMetricsController,
  createObservability,
} from '@ticket-booking/observability';

@Module({
  controllers: [HealthController, TicketController, ObservabilityMetricsController],
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
        new Kafka({
          clientId: config.kafkaClientId,
          brokers: config.kafkaBrokers,
          ...config.kafkaSecurity,
        }),
      inject: [TICKET_CONFIG],
    },
    {
      provide: KafkaDeadLetterPublisher,
      useFactory: (kafka: Kafka) => new KafkaDeadLetterPublisher(kafka, 'ticket-service'),
      inject: [Kafka],
    },
    TicketTransactionRunner,
    TicketRepository,
    CheckInRepository,
    TicketService,
    TicketConsumerLifecycle,
    TicketOutboxLifecycle,
    {
      provide: OBSERVABILITY,
      useFactory: () => createObservability('ticket-service'),
    },
  ],
})
export class TicketModule {}
