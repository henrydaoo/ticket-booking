import 'reflect-metadata';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import { correlationIdMiddleware } from './correlation-id.middleware';
import { NotificationConsumerLifecycle } from './consumer.lifecycle';
import { HealthController } from './health.controller';
import { NOTIFICATION_CONFIG, loadNotificationConfig } from './config';
import { ProviderController } from './provider.controller';
import { NotificationRepository } from './notification.repository';
import { NotificationDeliveryWorker } from './delivery.worker';
import { HttpEmailDeliveryAdapter } from './email-delivery';
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
  controllers: [HealthController, ProviderController, ObservabilityMetricsController],
  providers: [
    { provide: NOTIFICATION_CONFIG, useFactory: loadNotificationConfig },
    {
      provide: Pool,
      useFactory: (config: ReturnType<typeof loadNotificationConfig>) =>
        new Pool({ connectionString: config.databaseUrl }),
      inject: [NOTIFICATION_CONFIG],
    },
    {
      provide: Kafka,
      useFactory: (config: ReturnType<typeof loadNotificationConfig>) =>
        new Kafka({
          clientId: config.kafkaClientId,
          brokers: config.kafkaBrokers,
          ...config.kafkaSecurity,
        }),
      inject: [NOTIFICATION_CONFIG],
    },
    { provide: 'EMAIL_DELIVERY', useClass: HttpEmailDeliveryAdapter },
    NotificationRepository,
    NotificationConsumerLifecycle,
    NotificationDeliveryWorker,
    {
      provide: OBSERVABILITY,
      useFactory: () => createObservability('notification-service'),
    },
  ],
})
class NotificationModule {}

async function bootstrap(): Promise<void> {
  const telemetry = startTelemetry('notification-service');
  const app = await NestFactory.create(NotificationModule, {
    logger: false,
  });
  const observability = app.get(OBSERVABILITY);
  app.useLogger(new PinoNestLogger(observability.logger));
  app.useGlobalInterceptors(new HttpMetricsInterceptor(observability));
  const config = app.get(NOTIFICATION_CONFIG) as ReturnType<typeof loadNotificationConfig>;
  app.use(correlationIdMiddleware);
  await app.listen(config.port);
  process.once('SIGTERM', () => void telemetry?.shutdown());
}

void bootstrap();

