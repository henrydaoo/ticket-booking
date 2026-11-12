export interface VerificationDeliveryResponse {
  messageId: string;
}

export interface RegisterResponse {
  userId: string;
  email: string;
  emailVerified: false;
  verificationDelivery: VerificationDeliveryResponse;
}

export interface AuthUserResponse {
  id: string;
  email: string;
  roles: string[];
  branchIds: string[];
}

export interface TokenResponse {
  tokenType: 'Bearer';
  accessToken: string;
  expiresIn: number;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: AuthUserResponse;
}

export interface PasswordResetRequestResponse {
  accepted: true;
  delivery?: VerificationDeliveryResponse;
}

export interface MfaEnrollmentResponse {
  mfaEnabled: false;
  secret: string;
  otpauthUri: string;
  recoveryCodes: string[];
}
