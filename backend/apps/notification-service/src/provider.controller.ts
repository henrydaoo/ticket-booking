import { Controller, HttpCode, Post } from '@nestjs/common';

@Controller('provider')
export class ProviderController {
  @Post('email')
  @HttpCode(501)
  emailProviderBoundary(): { statusCode: 501; message: string } {
    return {
      statusCode: 501,
      message: 'Email provider delivery is deferred',
    };
  }
}

