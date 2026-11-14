import { Injectable } from '@nestjs/common';
import {
  EmailDeliveryPort,
  PasswordResetEmail,
  VerificationEmail,
} from '../../modules/auth/ports/email-delivery.port';

@Injectable()
export class LocalEmailDeliveryAdapter implements EmailDeliveryPort {
  private readonly messages = new Map<string, VerificationEmail | PasswordResetEmail>();

  async sendVerificationEmail(
    message: VerificationEmail,
  ): Promise<{ messageId: string }> {
    this.messages.set(message.messageId, message);
    return { messageId: message.messageId };
  }

  async sendPasswordResetEmail(
    message: PasswordResetEmail,
  ): Promise<{ messageId: string }> {
    this.messages.set(message.messageId, message);
    return { messageId: message.messageId };
  }

  getMessage(messageId: string): VerificationEmail | PasswordResetEmail | undefined {
    return this.messages.get(messageId);
  }
}
