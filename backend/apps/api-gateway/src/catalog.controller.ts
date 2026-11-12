import {
  Controller,
  Get,
  Headers,
  HttpException,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GATEWAY_CONFIG, GatewayConfig } from './config';
import { CORRELATION_ID_HEADER } from './correlation-id.middleware';

@Controller('catalog')
export class CatalogController {
  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  @Get('health')
  async health(): Promise<unknown> {
    try {
      const response = await fetch(`${this.config.catalogServiceUrl}/health`);

      if (!response.ok) {
        throw new Error(`Catalog Service returned HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      throw new ServiceUnavailableException('Catalog Service is unavailable', {
        cause: error,
      });
    }
  }

  @Get('movies')
  async movies(
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    try {
      const response = await fetch(`${this.config.catalogServiceUrl}/movies`, {
        headers: {
          [CORRELATION_ID_HEADER]: correlationId || '',
        },
      });
      const responseBody = await response.text();

      if (!response.ok) {
        throw new HttpException(responseBody, response.status);
      }

      return responseBody ? JSON.parse(responseBody) : null;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new ServiceUnavailableException('Catalog query boundary is unavailable', {
        cause: error,
      });
    }
  }
}
