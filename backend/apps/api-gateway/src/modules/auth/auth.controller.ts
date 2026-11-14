import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CORRELATION_ID_HEADER } from '../../correlation-id.middleware';
import { RateLimitGuard } from '../../common/rate-limit.guard';
import { AuthProxy } from './auth.proxy';

@Controller('auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly proxy: AuthProxy) {}

  @Post('register')
  register(@Body() body: unknown, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    return this.proxy.forward('/auth/register', 'POST', body, correlationId);
  }

  @Post('verify-email')
  verifyEmail(@Body() body: unknown, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    return this.proxy.forward('/auth/verify-email', 'POST', body, correlationId);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    return this.proxy.forward('/auth/login', 'POST', body, correlationId);
  }

  @Post('refresh')
  refresh(@Body() body: unknown, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    return this.proxy.forward('/auth/refresh', 'POST', body, correlationId);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() body: unknown, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    return this.proxy.forward('/auth/logout', 'POST', body, correlationId);
  }

  @Post('password-reset/request')
  @HttpCode(202)
  requestPasswordReset(
    @Body() body: unknown,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ) {
    return this.proxy.forward('/auth/password-reset/request', 'POST', body, correlationId);
  }

  @Post('password-reset/confirm')
  resetPassword(@Body() body: unknown, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    return this.proxy.forward('/auth/password-reset/confirm', 'POST', body, correlationId);
  }

  @Post('mfa/enroll')
  enrollMfa(@Body() body: unknown, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    return this.proxy.forward('/auth/mfa/enroll', 'POST', body, correlationId);
  }

  @Post('mfa/verify')
  verifyMfa(@Body() body: unknown, @Headers(CORRELATION_ID_HEADER) correlationId?: string) {
    return this.proxy.forward('/auth/mfa/verify', 'POST', body, correlationId);
  }
}
