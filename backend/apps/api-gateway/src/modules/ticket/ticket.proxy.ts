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
export class TicketProxy {
  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  async list(
    correlationId: string | undefined,
    principal: AuthenticatedPrincipal,
  ): Promise<unknown> {
    try {
      const response = await fetch(`${this.config.ticketServiceUrl}/tickets`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          [CORRELATION_ID_HEADER]: correlationId || '',
          ...principalHeaders(principal),
        },
      });
      const responseBody = await response.text();
      if (!response.ok) throw new HttpException(responseBody, response.status);
      return responseBody ? JSON.parse(responseBody) : null;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Ticket service is unavailable', { cause: error });
    }
  }

  async checkIn(
    correlationId: string | undefined,
    body: { qrToken: string; showtimeId: string; branchId: string },
    principal: AuthenticatedPrincipal,
  ): Promise<unknown> {
    return this.post('/check-ins', correlationId, body, principal);
  }

  async reverse(
    checkInId: string,
    correlationId: string | undefined,
    body: { reason: string; branchId: string },
    principal: AuthenticatedPrincipal,
  ): Promise<unknown> {
    return this.post(
      `/check-ins/${encodeURIComponent(checkInId)}/reverse`,
      correlationId,
      body,
      principal,
    );
  }

  private async post(
    route: string,
    correlationId: string | undefined,
    body: object,
    principal: AuthenticatedPrincipal,
  ): Promise<unknown> {
    try {
      const response = await fetch(`${this.config.ticketServiceUrl}${route}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
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
      throw new ServiceUnavailableException('Ticket service is unavailable', { cause: error });
    }
  }
}
