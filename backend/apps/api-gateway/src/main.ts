import 'reflect-metadata';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { AppModule } from './app.module';
import { GATEWAY_CONFIG } from './config';
import { correlationIdMiddleware } from './correlation-id.middleware';

loadDotenv({ path: join(__dirname, '../.env') });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  const config = app.get(GATEWAY_CONFIG);

  app.use(correlationIdMiddleware);
  await app.listen(config.port);
}

void bootstrap();

