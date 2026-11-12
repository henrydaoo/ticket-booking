import 'reflect-metadata';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { correlationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { IdentityModule } from './app.module';
import { IDENTITY_CONFIG, loadIdentityConfig } from './config/config';

loadDotenv({ path: join(__dirname, '../.env') });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(IdentityModule, {
    logger: ['log', 'warn', 'error'],
  });
  const config = app.get(IDENTITY_CONFIG) as ReturnType<typeof loadIdentityConfig>;

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

