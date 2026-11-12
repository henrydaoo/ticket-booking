import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { BOOKING_CONFIG, BookingConfig } from './config';
import { Inject } from '@nestjs/common';

@Injectable()
export class KafkaConsumerLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerLifecycle.name);
  private readonly consumer: Consumer;
  private connected = false;

  constructor(
    kafka: Kafka,
    @Inject(BOOKING_CONFIG) private readonly config: BookingConfig,
  ) {
    this.consumer = kafka.consumer({ groupId: config.kafkaGroupId });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.consumer.connect();
      this.connected = true;
      this.logger.log('Kafka consumer connected; event subscriptions are deferred');
    } catch (error) {
      this.logger.error(
        'Kafka consumer connection failed',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.connected) {
      return;
    }

    await this.consumer.disconnect();
    this.connected = false;
    this.logger.log(`Kafka consumer disconnected for ${this.config.serviceName}`);
  }

  isConnected(): boolean {
    return this.connected;
  }
}

