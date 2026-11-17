import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { BOOKING_CONFIG, BookingConfig } from './config';
import { Inject } from '@nestjs/common';
import { InventoryInitializer } from './inventory/inventory-initializer';
import { PaymentEvent } from './booking/booking.repository';
import { PaymentOrchestrator } from './booking/payment-orchestrator';
import { KafkaDeadLetterPublisher } from '@ticket-booking/event-recovery';

export const SHOWTIME_PUBLISHED_TOPIC = 'catalog.showtime-published.v1';
export const PAYMENT_SUCCEEDED_TOPIC = 'payment.payment-succeeded.v1';
export const PAYMENT_FAILED_TOPIC = 'payment.payment-failed.v1';
export const REFUND_COMPLETED_TOPIC = 'payment.refund-completed.v1';
export const REFUND_FAILED_TOPIC = 'payment.refund-failed.v1';

@Injectable()
export class KafkaConsumerLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerLifecycle.name);
  private readonly consumer: Consumer;
  private connected = false;

  constructor(
    kafka: Kafka,
    @Inject(BOOKING_CONFIG) private readonly config: BookingConfig,
    private readonly inventoryInitializer: InventoryInitializer,
    private readonly paymentOrchestrator: PaymentOrchestrator,
    private readonly deadLetter: KafkaDeadLetterPublisher,
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
      await this.consumer.subscribe({ topic: PAYMENT_SUCCEEDED_TOPIC, fromBeginning: true });
      await this.consumer.subscribe({ topic: PAYMENT_FAILED_TOPIC, fromBeginning: true });
      await this.consumer.subscribe({ topic: REFUND_COMPLETED_TOPIC, fromBeginning: true });
      await this.consumer.subscribe({ topic: REFUND_FAILED_TOPIC, fromBeginning: true });
      void this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const raw = message.value?.toString('utf8');
          let payload: unknown = null;
          try {
            if (!raw) throw new Error(`Received empty Kafka message from ${topic}`);
            payload = JSON.parse(raw) as unknown;
            const event = payload;
            if (topic === SHOWTIME_PUBLISHED_TOPIC) {
              await this.inventoryInitializer.initialize(event);
            } else {
              await this.paymentOrchestrator.process(event as PaymentEvent);
            }
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
    if (this.connected) {
      await this.consumer.disconnect();
    }
    this.connected = false;
    await this.deadLetter.disconnect();
    this.logger.log(`Kafka consumer disconnected for ${this.config.serviceName}`);
  }

  isConnected(): boolean {
    return this.connected;
  }
}

