import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import {
  EmailDeliveryPort,
  PasswordResetEmail,
  VerificationEmail,
} from '../../modules/auth/ports/email-delivery.port';
import { IdentityConfig } from '../../config/config';

export class SmtpEmailDeliveryAdapter implements EmailDeliveryPort {
  private readonly logger = new Logger(SmtpEmailDeliveryAdapter.name);
  private readonly transporter: Transporter;

  constructor(private readonly config: IdentityConfig) {
    if (
      !config.smtpHost ||
      !config.smtpPort ||
      !config.smtpUser ||
      !config.smtpPassword ||
      !config.emailFrom
    ) {
      throw new Error('SMTP email delivery requires complete SMTP configuration');
    }

    this.transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPassword },
    });
  }

  async sendVerificationEmail(message: VerificationEmail): Promise<{ messageId: string }> {
    return this.send(message.messageId, message.recipient, 'Verify your Cinema Booking email', `Verify your email: ${message.verificationLink}`);
  }

  async sendPasswordResetEmail(message: PasswordResetEmail): Promise<{ messageId: string }> {
    return this.send(message.messageId, message.recipient, 'Reset your Cinema Booking password', `Reset your password: ${message.resetLink}`);
  }

  private async send(
    messageId: string,
    recipient: string,
    subject: string,
    text: string,
  ): Promise<{ messageId: string }> {
    const result = await this.transporter.sendMail({
      from: this.config.emailFrom,
      to: recipient,
      subject,
      text,
      headers: { 'X-Cinema-Message-Id': messageId },
    });
    this.logger.log(`Email accepted by SMTP provider for message ${messageId}`);
    return { messageId: result.messageId || messageId };
  }
}
