import {
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GATEWAY_CONFIG, GatewayConfig } from '../../config';
import { CORRELATION_ID_HEADER } from '../../correlation-id.middleware';

@Injectable()
export class AuthProxy {
  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  async forward(
    route: string,
    method: string,
    body: unknown,
    correlationId?: string,
  ): Promise<unknown> {
    try {
      const response = await fetch(`${this.config.identityServiceUrl}${route}`, {
        method,
        headers: {
          'content-type': 'application/json',
          [CORRELATION_ID_HEADER]: correlationId || '',
        },
        body: method === 'GET' ? undefined : JSON.stringify(body),
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
      throw new ServiceUnavailableException(
        'Identity Service authentication boundary is unavailable',
        { cause: error },
      );
    }
  }
}
