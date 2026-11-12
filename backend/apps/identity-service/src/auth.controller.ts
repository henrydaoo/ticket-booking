import { Controller, HttpCode, Post } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Post('login')
  @HttpCode(501)
  loginBoundary(): {
    statusCode: 501;
    message: string;
  } {
    return {
      statusCode: 501,
      message: 'Authentication workflow is deferred to a later foundation step',
    };
  }
}

