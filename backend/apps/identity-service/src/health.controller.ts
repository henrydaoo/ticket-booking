import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { IDENTITY_CONFIG, IdentityConfig } from './config';

@Controller()
export class HealthController {
  constructor(
    @Inject(IDENTITY_CONFIG) private readonly config: IdentityConfig,
    @Inject(Pool) private readonly database: Pool,
  ) {}

  @Get('health')
  health(): { status: 'ok'; service: string } {
    return { status: 'ok', service: this.config.serviceName };
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ready'; service: string }> {
    try {
      await this.database.query('SELECT 1');
    } catch (error) {
      throw new ServiceUnavailableException('Identity database is not ready', {
        cause: error,
      });
    }

    return { status: 'ready', service: this.config.serviceName };
  }
}

