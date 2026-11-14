import 'reflect-metadata';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import { PAYMENT_CONFIG, loadPaymentConfig } from './config';
import { correlationIdMiddleware } from './correlation-id.middleware';
import { PaymentConsumerLifecycle } from './consumer.lifecycle';
import { HealthController } from './health.controller';
import { ProviderController } from './provider.controller';
import { PaymentController } from './payment.controller';
import { TransactionRunner } from './transaction.runner';
import { PaymentRepository } from './payment.repository';
import { BookingClient } from './booking.client';
import { PaymentService } from './payment.service';
import { VnpayProvider } from './provider/vnpay.provider';

loadDotenv({ path: join(__dirname, '../.env') });

@Module({
  controllers: [HealthController, ProviderController, PaymentController],
  providers: [
    { provide: PAYMENT_CONFIG, useFactory: loadPaymentConfig },
    {
      provide: Pool,
      useFactory: (config: ReturnType<typeof loadPaymentConfig>) =>
        new Pool({ connectionString: config.databaseUrl }),
      inject: [PAYMENT_CONFIG],
    },
    {
      provide: Kafka,
      useFactory: (config: ReturnType<typeof loadPaymentConfig>) =>
        new Kafka({ clientId: config.kafkaClientId, brokers: config.kafkaBrokers }),
      inject: [PAYMENT_CONFIG],
    },
    PaymentConsumerLifecycle,
    TransactionRunner,
    PaymentRepository,
    BookingClient,
    PaymentService,
    VnpayProvider,
    { provide: 'PAYMENT_PROVIDER', useExisting: VnpayProvider },
  ],
})
class PaymentModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(PaymentModule, { logger: ['log', 'warn', 'error'] });
  const config = app.get(PAYMENT_CONFIG) as ReturnType<typeof loadPaymentConfig>;
  app.use(correlationIdMiddleware);
  await app.listen(config.port);
}

void bootstrap();

