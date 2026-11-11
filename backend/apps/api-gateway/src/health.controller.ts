import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GATEWAY_CONFIG, GatewayConfig } from './config';

@Controller()
export class HealthController {
  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  @Get('health')
  health(): { status: 'ok'; service: string } {
    return { status: 'ok', service: this.config.serviceName };
  }

  @Get('ready')
  async ready(): Promise<{ status: 'ready'; service: string }> {
    try {
      const response = await fetch(`${this.config.identityServiceUrl}/health`);

      if (!response.ok) {
        throw new Error(`Identity Service returned HTTP ${response.status}`);
      }
    } catch (error) {
      throw new ServiceUnavailableException('Identity Service is not ready', {
        cause: error,
      });
    }

    return { status: 'ready', service: this.config.serviceName };
  }
}

