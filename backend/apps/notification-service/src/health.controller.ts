import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Pool } from 'pg';
import { NOTIFICATION_CONFIG, NotificationConfig } from './config';
import { NotificationConsumerLifecycle } from './consumer.lifecycle';

@Controller()
export class HealthController {
  constructor(
    @Inject(NOTIFICATION_CONFIG) private readonly config: NotificationConfig,
    @Inject(Pool) private readonly database: Pool,
    private readonly consumer: NotificationConsumerLifecycle,
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
      throw new ServiceUnavailableException('Notification dependencies are not ready', { cause: error });
    }
    return { status: 'ready', service: this.config.serviceName };
  }
}

