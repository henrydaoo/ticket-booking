import { Module } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { CATALOG_CONFIG, CatalogConfig } from '../../../config';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { CatalogOutboxPublisher } from './catalog-outbox.publisher';
import { CatalogOutboxRepository } from './catalog-outbox.repository';
import { CATALOG_EVENT_PRODUCER } from './catalog-outbox.tokens';

@Module({
  imports: [DatabaseModule],
  providers: [
    CatalogOutboxRepository,
    {
      provide: Kafka,
      useFactory: (config: CatalogConfig) =>
        new Kafka({
          clientId: config.kafkaClientId,
          brokers: config.kafkaBrokers,
        }),
      inject: [CATALOG_CONFIG],
    },
    {
      provide: CATALOG_EVENT_PRODUCER,
      useFactory: (kafka: Kafka) => kafka.producer(),
      inject: [Kafka],
    },
    CatalogOutboxPublisher,
  ],
})
export class CatalogOutboxModule {}
