import { Module } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { HealthController } from './health.controller';
import { CATALOG_CONFIG, CatalogConfig } from './config';
import { CatalogModule } from './modules/catalog/catalog.module';

@Module({
  imports: [CatalogModule],
  controllers: [HealthController],
  providers: [
    {
      provide: Kafka,
      useFactory: (config: CatalogConfig) =>
        new Kafka({
          clientId: config.kafkaClientId,
          brokers: config.kafkaBrokers,
        }),
      inject: [CATALOG_CONFIG],
    },
  ],
})
export class AppModule {}
