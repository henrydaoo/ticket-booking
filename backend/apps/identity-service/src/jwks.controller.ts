import { Controller, Get, HttpCode } from '@nestjs/common';

@Controller('.well-known')
export class JwksController {
  @Get('jwks.json')
  @HttpCode(501)
  jwksBoundary(): {
    statusCode: 501;
    message: string;
  } {
    return {
      statusCode: 501,
      message: 'JWKS publication is deferred to authentication implementation',
    };
  }
}

