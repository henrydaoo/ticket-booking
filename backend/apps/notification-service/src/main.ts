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

loadDotenv({ path: join(__dirname, '../.env') });

@Module({
  controllers: [HealthController, ProviderController],
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
  ],
})
class NotificationModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(NotificationModule, {
    logger: ['log', 'warn', 'error'],
  });
  const config = app.get(NOTIFICATION_CONFIG) as ReturnType<typeof loadNotificationConfig>;
  app.use(correlationIdMiddleware);
  await app.listen(config.port);
}

void bootstrap();

