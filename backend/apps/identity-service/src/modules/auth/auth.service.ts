import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { IDENTITY_CONFIG, IdentityConfig } from '../../config/config';
import {
  EMAIL_DELIVERY,
  EmailDeliveryPort,
} from './ports/email-delivery.port';
import {
  IdentityRepository,
  IdentityUser,
} from './auth.repository';
import {
  MfaEnrollmentResponse,
  PasswordResetRequestResponse,
  RegisterResponse,
  TokenResponse,
} from './interfaces/auth-response.interface';
import { JwtTokenService } from './jwt-token.service';
import { PasswordService } from './password.service';
import { TotpService } from './totp.service';

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: IdentityRepository,
    @Inject(IDENTITY_CONFIG) private readonly config: IdentityConfig,
    @Inject(EMAIL_DELIVERY) private readonly emailDelivery: EmailDeliveryPort,
    private readonly passwords: PasswordService,
    private readonly jwtTokens: JwtTokenService,
    private readonly totp: TotpService,
  ) {}

  async register(email: string, password: string): Promise<RegisterResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await this.passwords.hash(password);
    const userId = randomUUID();
    const verificationToken = randomBytes(32).toString('base64url');
    const verificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.repository.registerUser({
      userId,
      email: normalizedEmail,
      passwordHash,
      verificationTokenHash: tokenHash(verificationToken),
    });

    const verificationDelivery = await this.emailDelivery.sendVerificationEmail({
      messageId: randomUUID(),
      recipient: normalizedEmail,
      verificationLink: `${this.config.emailLinkBaseUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`,
      expiresAt: verificationExpiresAt.toISOString(),
    });

    return {
      userId,
      email: normalizedEmail,
      emailVerified: false,
      verificationDelivery,
    };
  }

  async verifyEmail(token: string): Promise<{ verified: true }> {
    if (!(await this.repository.verifyEmail(tokenHash(token)))) {
      throw new UnauthorizedException('Email verification token is invalid or expired');
    }

    return { verified: true };
  }

  async login(
    email: string,
    password: string,
    mfaCode?: string,
    recoveryCode?: string,
  ): Promise<TokenResponse> {
    const user = await this.repository.findUserByEmail(email.trim().toLowerCase());

    if (!user || !(await this.passwords.verify(password, user.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.email_verified_at) {
      throw new UnauthorizedException('Email address must be verified');
    }

    const roles = await this.repository.rolesForUser(user.id);
    const mfaCompleted = await this.verifyLoginMfa(
      user,
      roles,
      mfaCode,
      recoveryCode,
    );
    return this.issueTokens(user, mfaCompleted);
  }

  async refresh(refreshToken: string): Promise<TokenResponse> {
    const user = await this.repository.findRefreshSession(tokenHash(refreshToken));

    if (!user) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const roles = await this.repository.rolesForUser(user.id);
    const branchIds = await this.repository.branchIdsForUser(user.id);
    const accessToken = this.jwtTokens.issueAccessToken({
      userId: user.id,
      roles,
      branchIds,
      mfaCompleted: user.mfa_completed,
    });
    const nextRefreshToken = randomBytes(48).toString('base64url');
    const nextRefreshTokenId = randomUUID();
    await this.repository.rotateRefreshToken({
      oldTokenId: user.refresh_token_id,
      newTokenId: nextRefreshTokenId,
      userId: user.id,
      tokenHash: tokenHash(nextRefreshToken),
      ttlSeconds: this.config.refreshTokenTtlSeconds,
      mfaCompleted: user.mfa_completed,
    });

    return {
      tokenType: 'Bearer',
      accessToken: accessToken.token,
      expiresIn: this.config.accessTokenTtlSeconds,
      accessTokenExpiresAt: accessToken.expiresAt,
      refreshToken: nextRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        roles,
        branchIds,
      },
    };
  }

  async logout(refreshToken: string): Promise<{ revoked: true }> {
    await this.repository.revokeRefreshToken(tokenHash(refreshToken));

    return { revoked: true };
  }

  async requestPasswordReset(
    email: string,
  ): Promise<PasswordResetRequestResponse> {
    const user = await this.repository.findUserByEmail(email.trim().toLowerCase());

    if (!user) {
      return { accepted: true };
    }

    const token = randomBytes(32).toString('base64url');
    const resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.repository.createPasswordResetToken(user.id, tokenHash(token));

    const delivery = await this.emailDelivery.sendPasswordResetEmail({
      messageId: randomUUID(),
      recipient: email.trim().toLowerCase(),
      resetLink: `${this.config.emailLinkBaseUrl}/reset-password?token=${encodeURIComponent(token)}`,
      expiresAt: resetExpiresAt.toISOString(),
    });

    return {
      accepted: true,
      delivery,
    };
  }

  async resetPassword(token: string, password: string): Promise<{ reset: true }> {
    const passwordHash = await this.passwords.hash(password);
    if (!(await this.repository.resetPassword(tokenHash(token), passwordHash))) {
      throw new UnauthorizedException('Password reset token is invalid or expired');
    }

    return { reset: true };
  }

  async enrollMfa(
    email: string,
    password: string,
  ): Promise<MfaEnrollmentResponse> {
    const user = await this.repository.findUserByEmail(email.trim().toLowerCase());
    if (!user || !(await this.passwords.verify(password, user.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.email_verified_at) {
      throw new UnauthorizedException('Email address must be verified');
    }

    const roles = await this.repository.rolesForUser(user.id);
    if (!roles.includes('PLATFORM_ADMIN')) {
      throw new UnauthorizedException('Platform Admin role is required');
    }
    if (user.mfa_enabled) {
      throw new BadRequestException('MFA is already enrolled');
    }

    const secret = this.totp.generateSecret();
    const recoveryCodes = this.totp.generateRecoveryCodes();
    await this.repository.startMfaEnrollment({
      userId: user.id,
      secret,
      recoveryCodeHashes: recoveryCodes.map(tokenHash),
    });

    return {
      mfaEnabled: false,
      secret,
      otpauthUri: this.totp.buildOtpAuthUri(
        secret,
        user.email,
        this.config.jwtIssuer,
      ),
      recoveryCodes,
    };
  }

  async completeMfaEnrollment(
    email: string,
    password: string,
    code: string,
  ): Promise<TokenResponse> {
    const user = await this.repository.findUserByEmail(email.trim().toLowerCase());
    if (!user || !(await this.passwords.verify(password, user.password_hash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (
      !user.mfa_pending_secret ||
      !this.totp.verifyCode(user.mfa_pending_secret, code)
    ) {
      throw new UnauthorizedException('MFA code is invalid');
    }

    await this.repository.completeMfaEnrollment(user.id);

    return this.issueTokens(user, true);
  }

  private async verifyLoginMfa(
    user: IdentityUser,
    roles: string[],
    code: string | undefined,
    recoveryCode: string | undefined,
  ): Promise<boolean> {
    if (!roles.includes('PLATFORM_ADMIN') || !user.mfa_enabled) {
      return false;
    }
    if (code && user.mfa_secret && this.totp.verifyCode(user.mfa_secret, code)) {
      return true;
    }
    if (
      recoveryCode &&
      (await this.repository.consumeRecoveryCode(user.id, tokenHash(recoveryCode)))
    ) {
      await this.repository.addAuditRecord(
        undefined,
        user.id,
        'MFA_RECOVERY_CODE_USED',
      );
      return true;
    }

    throw new UnauthorizedException('MFA verification is required');
  }

  private async issueTokens(
    user: IdentityUser,
    mfaCompleted: boolean,
  ): Promise<TokenResponse> {
    const roles = await this.repository.rolesForUser(user.id);
    const branchIds = await this.repository.branchIdsForUser(user.id);
    const accessToken = this.jwtTokens.issueAccessToken({
      userId: user.id,
      roles,
      branchIds,
      mfaCompleted,
    });
    const refreshToken = randomBytes(48).toString('base64url');

    await this.repository.createRefreshToken({
      id: randomUUID(),
      userId: user.id,
      tokenHash: tokenHash(refreshToken),
      ttlSeconds: this.config.refreshTokenTtlSeconds,
      mfaCompleted,
    });

    return {
      tokenType: 'Bearer',
      accessToken: accessToken.token,
      expiresIn: this.config.accessTokenTtlSeconds,
      accessTokenExpiresAt: accessToken.expiresAt,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        roles,
        branchIds,
      },
    };
  }
}
