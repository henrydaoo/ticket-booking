import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATION_CONFIG, NotificationConfig } from './config';

export type EmailDeliveryMessage = {
  recipientEmail: string;
  notificationType: string;
  templateData: Record<string, unknown>;
  correlationId: string;
};

export type EmailDeliveryResult = { retryable: boolean };

export interface EmailDeliveryPort {
  send(message: EmailDeliveryMessage): Promise<EmailDeliveryResult>;
}

@Injectable()
export class HttpEmailDeliveryAdapter implements EmailDeliveryPort {
  constructor(@Inject(NOTIFICATION_CONFIG) private readonly config: NotificationConfig) {}

  async send(message: EmailDeliveryMessage): Promise<EmailDeliveryResult> {
    const response = await fetch(this.config.emailProviderBaseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.emailProviderApiKey}`,
      },
      body: JSON.stringify(message),
    });
    if (response.ok) return { retryable: false };
    const error = new Error(`EMAIL_PROVIDER_HTTP_${response.status}`);
    Object.assign(error, { retryable: response.status >= 500 || response.status === 429 });
    throw error;
  }
}
