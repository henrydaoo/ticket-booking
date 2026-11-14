import {
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GATEWAY_CONFIG, GatewayConfig } from '../../config';
import { CORRELATION_ID_HEADER } from '../../correlation-id.middleware';
import { AuthenticatedPrincipal, principalHeaders } from '../auth/auth.types';

@Injectable()
export class PaymentProxy {
  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  async create(
    correlationId: string | undefined,
    principal: AuthenticatedPrincipal,
    body: unknown,
  ): Promise<unknown> {
    try {
      const response = await fetch(`${this.config.paymentServiceUrl}/payments`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [CORRELATION_ID_HEADER]: correlationId || '',
          ...principalHeaders(principal),
        },
        body: JSON.stringify(body),
      });
      const responseBody = await response.text();
      if (!response.ok) throw new HttpException(responseBody, response.status);
      return responseBody ? JSON.parse(responseBody) : null;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Payment service is unavailable', { cause: error });
    }
  }

  async webhook(correlationId: string | undefined, body: unknown): Promise<unknown> {
    try {
      const response = await fetch(`${this.config.paymentServiceUrl}/webhooks/vnpay`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [CORRELATION_ID_HEADER]: correlationId || '',
        },
        body: JSON.stringify(body),
      });
      const responseBody = await response.text();
      if (!response.ok) throw new HttpException(responseBody, response.status);
      return responseBody ? JSON.parse(responseBody) : null;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Payment service is unavailable', { cause: error });
    }
  }
}
