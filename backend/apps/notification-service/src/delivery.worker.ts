import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EmailDeliveryPort } from './email-delivery';
import { NotificationRepository } from './notification.repository';

@Injectable()
export class NotificationDeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDeliveryWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly repository: NotificationRepository,
    @Inject('EMAIL_DELIVERY') private readonly email: EmailDeliveryPort,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.processOnce().catch((error: unknown) =>
        this.logger.error('Notification delivery failed', error instanceof Error ? error.stack : String(error)),
      );
    }, 1000);
    this.timer.unref();
    void this.processOnce();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async processOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const job = await this.repository.claimNext();
      if (!job) return;
      try {
        const result = await this.email.send({
          recipientEmail: job.recipientEmail,
          notificationType: job.type,
          templateData: job.templateData,
          correlationId: job.correlationId,
        });
        if (!result) throw new Error('EMAIL_PROVIDER_EMPTY_RESULT');
        if (result.retryable) throw Object.assign(new Error('EMAIL_PROVIDER_RETRYABLE_FAILURE'), { retryable: true });
        await this.repository.markDelivered(job);
      } catch (error) {
        const retryable = error instanceof Error && 'retryable' in error && error.retryable === true;
        await this.repository.markFailed(job, error instanceof Error ? error.message : String(error), retryable);
      }
    } finally {
      this.running = false;
    }
  }
}
