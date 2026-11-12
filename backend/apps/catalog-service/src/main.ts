import 'reflect-metadata';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import { CatalogController } from './catalog.controller';
import { CATALOG_CONFIG, loadCatalogConfig } from './config';
import { correlationIdMiddleware } from './correlation-id.middleware';
import { HealthController } from './health.controller';

loadDotenv({ path: join(__dirname, '../.env') });

@Module({
  controllers: [CatalogController, HealthController],
  providers: [
    {
      provide: CATALOG_CONFIG,
      useFactory: loadCatalogConfig,
    },
    {
      provide: Pool,
      useFactory: (config: ReturnType<typeof loadCatalogConfig>) =>
        new Pool({ connectionString: config.databaseUrl }),
      inject: [CATALOG_CONFIG],
    },
    {
      provide: Kafka,
      useFactory: (config: ReturnType<typeof loadCatalogConfig>) =>
        new Kafka({
          clientId: config.kafkaClientId,
          brokers: config.kafkaBrokers,
        }),
      inject: [CATALOG_CONFIG],
    },
  ],
})
class CatalogModule {}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(CatalogModule, {
    logger: ['log', 'warn', 'error'],
  });
  const config = app.get(CATALOG_CONFIG) as ReturnType<typeof loadCatalogConfig>;

  app.use(correlationIdMiddleware);
  await app.listen(config.port);
}

void bootstrap();

