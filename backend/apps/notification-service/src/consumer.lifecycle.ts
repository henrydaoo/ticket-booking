import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { NOTIFICATION_CONFIG, NotificationConfig } from './config';
import { buildNotificationJobs, parseNotificationEvent } from './notification.parser';
import { NotificationRepository } from './notification.repository';
import { KafkaDeadLetterPublisher } from '@ticket-booking/event-recovery';

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
    private readonly deadLetter: KafkaDeadLetterPublisher,
  ) {
    this.consumer = kafka.consumer({ groupId: config.kafkaGroupId });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.consumer.connect();
      this.connected = true;
      await this.consumer.subscribe({ topics: NOTIFICATION_TOPICS, fromBeginning: true });
      void this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const raw = message.value?.toString('utf8');
          let payload: unknown = null;
          try {
            if (!raw) throw new Error('Received empty notification event');
            payload = JSON.parse(raw) as unknown;
            const event = parseNotificationEvent(payload);
            await this.repository.createJobs(event, buildNotificationJobs(event));
          } catch (error) {
            await this.deadLetter.publish({
              sourceTopic: topic,
              sourcePartition: partition,
              sourceOffset: message.offset,
              error,
              payload,
            });
            this.logger.error(
              `Kafka event moved to ${topic}.dlq.v1`,
              error instanceof Error ? error.stack : String(error),
            );
          }
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
    await this.deadLetter.disconnect();
  }

  isConnected(): boolean {
    return this.connected;
  }
}

