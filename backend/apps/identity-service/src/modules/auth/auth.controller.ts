import {
  Body,
  Controller,
  HttpCode,
  Post,
} from '@nestjs/common';
import { EnrollMfaDto } from './dto/enroll-mfa.dto';
import {
  MfaEnrollmentResponse,
  PasswordResetRequestResponse,
  RegisterResponse,
  TokenResponse,
} from './interfaces/auth-response.interface';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: RegisterDto): Promise<RegisterResponse> {
    return this.auth.register(body.email, body.password);
  }

  @Post('verify-email')
  verifyEmail(@Body() body: VerifyEmailDto): Promise<{ verified: true }> {
    return this.auth.verifyEmail(body.token);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto): Promise<TokenResponse> {
    return this.auth.login(
      body.email,
      body.password,
      body.mfaCode,
      body.recoveryCode,
    );
  }

  @Post('refresh')
  refresh(@Body() body: RefreshTokenDto): Promise<TokenResponse> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() body: LogoutDto): Promise<{ revoked: true }> {
    return this.auth.logout(body.refreshToken);
  }

  @Post('password-reset/request')
  @HttpCode(202)
  requestPasswordReset(
    @Body() body: PasswordResetRequestDto,
  ): Promise<PasswordResetRequestResponse> {
    return this.auth.requestPasswordReset(body.email);
  }

  @Post('mfa/enroll')
  enrollMfa(@Body() body: EnrollMfaDto): Promise<MfaEnrollmentResponse> {
    return this.auth.enrollMfa(body.email, body.password);
  }

  @Post('mfa/verify')
  verifyMfa(@Body() body: VerifyMfaDto): Promise<TokenResponse> {
    return this.auth.completeMfaEnrollment(
      body.email,
      body.password,
      body.code,
    );
  }

  @Post('password-reset/confirm')
  resetPassword(
    @Body() body: PasswordResetConfirmDto,
  ): Promise<{ reset: true }> {
    return this.auth.resetPassword(body.token, body.password);
  }
}

