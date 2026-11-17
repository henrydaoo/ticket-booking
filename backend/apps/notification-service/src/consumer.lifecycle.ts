import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { NOTIFICATION_CONFIG, NotificationConfig } from './config';
import { buildNotificationJobs, parseNotificationEvent } from './notification.parser';
import { NotificationRepository } from './notification.repository';

const NOTIFICATION_TOPICS = [
  'booking.booking-confirmed.v1',
  'ticket.ticket-issued.v1',
];

@Injectable()
export class NotificationConsumerLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationConsumerLifecycle.name);
  private readonly consumer: Consumer;
  private connected = false;

  constructor(
    kafka: Kafka,
    @Inject(NOTIFICATION_CONFIG) private readonly config: NotificationConfig,
    private readonly repository: NotificationRepository,
  ) {
    this.consumer = kafka.consumer({ groupId: config.kafkaGroupId });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.consumer.connect();
      this.connected = true;
      await this.consumer.subscribe({ topics: NOTIFICATION_TOPICS, fromBeginning: true });
      void this.consumer.run({
        eachMessage: async ({ message }) => {
          if (!message.value) throw new Error('Received empty notification event');
          const event = parseNotificationEvent(JSON.parse(message.value.toString('utf8')) as unknown);
          await this.repository.createJobs(event, buildNotificationJobs(event));
        },
      }).catch((error: unknown) => {
        this.connected = false;
        this.logger.error(
          'Notification Kafka consumer stopped unexpectedly',
          error instanceof Error ? error.stack : String(error),
        );
      });
      this.logger.log(`Kafka consumer subscribed to ${NOTIFICATION_TOPICS.join(', ')}`);
    } catch (error) {
      this.logger.error('Kafka consumer connection failed', error instanceof Error ? error.message : String(error));
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connected) await this.consumer.disconnect();
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

