import {
  Body,
  Controller,
  Headers,
  HttpException,
  Inject,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GATEWAY_CONFIG, GatewayConfig } from './config';
import { CORRELATION_ID_HEADER } from './correlation-id.middleware';

@Controller('auth')
export class AuthController {
  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  @Post('login')
  async login(
    @Body() body: unknown,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    try {
      const response = await fetch(`${this.config.identityServiceUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [CORRELATION_ID_HEADER]: correlationId || '',
        },
        body: JSON.stringify(body),
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

