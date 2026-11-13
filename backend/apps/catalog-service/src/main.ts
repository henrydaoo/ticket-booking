import 'reflect-metadata';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { CATALOG_CONFIG, loadCatalogConfig } from './config';
import { correlationIdMiddleware } from './correlation-id.middleware';
import { AppModule } from './app.module';

loadDotenv({ path: join(__dirname, '../.env') });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  const config = app.get(CATALOG_CONFIG) as ReturnType<typeof loadCatalogConfig>;

  app.use(correlationIdMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  await app.listen(config.port);
}

void bootstrap();

