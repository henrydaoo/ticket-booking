import {
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GATEWAY_CONFIG, GatewayConfig } from '../../config';
import { CORRELATION_ID_HEADER } from '../../correlation-id.middleware';

@Injectable()
export class CatalogProxy {
  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  async forward(route: string, correlationId?: string): Promise<unknown> {
    try {
      const response = await fetch(`${this.config.catalogServiceUrl}${route}`, {
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
