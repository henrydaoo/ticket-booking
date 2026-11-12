import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { NOTIFICATION_CONFIG, NotificationConfig } from './config';

@Injectable()
export class NotificationConsumerLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationConsumerLifecycle.name);
  private readonly consumer: Consumer;
  private connected = false;

  constructor(
    kafka: Kafka,
    @Inject(NOTIFICATION_CONFIG) private readonly config: NotificationConfig,
  ) {
    this.consumer = kafka.consumer({ groupId: config.kafkaGroupId });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.consumer.connect();
      this.connected = true;
      this.logger.log('Kafka consumer connected; notification delivery is deferred');
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

