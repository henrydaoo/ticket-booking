import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { BOOKING_CONFIG, BookingConfig } from './config';
import { Inject } from '@nestjs/common';
import { InventoryInitializer } from './inventory/inventory-initializer';

export const SHOWTIME_PUBLISHED_TOPIC = 'catalog.showtime-published.v1';

@Injectable()
export class KafkaConsumerLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerLifecycle.name);
  private readonly consumer: Consumer;
  private connected = false;

  constructor(
    kafka: Kafka,
    @Inject(BOOKING_CONFIG) private readonly config: BookingConfig,
    private readonly inventoryInitializer: InventoryInitializer,
  ) {
    this.consumer = kafka.consumer({ groupId: config.kafkaGroupId });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topic: SHOWTIME_PUBLISHED_TOPIC,
        fromBeginning: true,
      });
      void this.consumer.run({
        eachMessage: async ({ message }) => {
          if (!message.value) {
            throw new Error('Received empty ShowtimePublished Kafka message');
          }
          await this.inventoryInitializer.initialize(
            JSON.parse(message.value.toString('utf8')),
          );
        },
      }).catch((error: unknown) => {
        this.logger.error(
          'Booking Kafka consumer stopped unexpectedly',
          error instanceof Error ? error.stack : String(error),
        );
        this.connected = false;
      });
      this.connected = true;
      this.logger.log(`Kafka consumer subscribed to ${SHOWTIME_PUBLISHED_TOPIC}`);
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

