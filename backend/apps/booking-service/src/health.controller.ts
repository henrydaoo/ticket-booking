import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { BOOKING_CONFIG, BookingConfig } from './config';
import { KafkaConsumerLifecycle } from './kafka-consumer.lifecycle';

@Controller()
export class HealthController {
  constructor(
    @Inject(BOOKING_CONFIG) private readonly config: BookingConfig,
    @Inject(Pool) private readonly database: Pool,
    private readonly kafka: KafkaConsumerLifecycle,
  ) {}

  @Get('health')
  health(): { status: 'ok'; service: string } {
    return { status: 'ok', service: this.config.serviceName };
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ready'; service: string }> {
    try {
      await this.database.query('SELECT 1');
      if (!this.kafka.isConnected()) {
        throw new Error('Kafka consumer is not connected');
      }
    } catch (error) {
      throw new ServiceUnavailableException('Booking dependencies are not ready', {
        cause: error,
      });
    }

    return { status: 'ready', service: this.config.serviceName };
  }
}

