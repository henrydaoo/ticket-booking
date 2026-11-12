import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Pool } from 'pg';
import { PAYMENT_CONFIG, PaymentConfig } from './config';
import { PaymentConsumerLifecycle } from './consumer.lifecycle';

@Controller()
export class HealthController {
  constructor(
    @Inject(PAYMENT_CONFIG) private readonly config: PaymentConfig,
    @Inject(Pool) private readonly database: Pool,
    private readonly consumer: PaymentConsumerLifecycle,
  ) {}

  @Get('health')
  health(): { status: 'ok'; service: string } {
    return { status: 'ok', service: this.config.serviceName };
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ready'; service: string }> {
    try {
      await this.database.query('SELECT 1');
      if (!this.consumer.isConnected()) throw new Error('Kafka consumer is not connected');
    } catch (error) {
      throw new ServiceUnavailableException('Payment dependencies are not ready', { cause: error });
    }
    return { status: 'ready', service: this.config.serviceName };
  }
}

