import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { PAYMENT_CONFIG, PaymentConfig } from './config';

@Injectable()
export class PaymentConsumerLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentConsumerLifecycle.name);
  private readonly consumer: Consumer;
  private connected = false;

  constructor(kafka: Kafka, @Inject(PAYMENT_CONFIG) private readonly config: PaymentConfig) {
    this.consumer = kafka.consumer({ groupId: config.kafkaGroupId });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.consumer.connect();
      this.connected = true;
      this.logger.log('Kafka consumer connected; payment events are deferred');
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

