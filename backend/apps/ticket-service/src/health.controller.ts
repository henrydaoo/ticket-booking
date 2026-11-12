import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Pool } from 'pg';
import { TICKET_CONFIG, TicketConfig } from './config';
import { TicketConsumerLifecycle } from './consumer.lifecycle';

@Controller()
export class HealthController {
  constructor(
    @Inject(TICKET_CONFIG) private readonly config: TicketConfig,
    @Inject(Pool) private readonly database: Pool,
    private readonly consumer: TicketConsumerLifecycle,
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
      throw new ServiceUnavailableException('Ticket dependencies are not ready', { cause: error });
    }
    return { status: 'ready', service: this.config.serviceName };
  }
}

