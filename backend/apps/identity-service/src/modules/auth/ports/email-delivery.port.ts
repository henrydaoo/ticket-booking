export type VerificationEmail = {
  messageId: string;
  recipient: string;
  verificationLink: string;
  expiresAt: string;
};

export type PasswordResetEmail = {
  messageId: string;
  recipient: string;
  resetLink: string;
  expiresAt: string;
};

export interface EmailDeliveryPort {
  sendVerificationEmail(message: VerificationEmail): Promise<{ messageId: string }>;
  sendPasswordResetEmail(message: PasswordResetEmail): Promise<{ messageId: string }>;
}

export const EMAIL_DELIVERY = Symbol('EMAIL_DELIVERY');
