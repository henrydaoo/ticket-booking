import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { PAYMENT_CONFIG, PaymentConfig } from './config';
import { RefundService } from './refund.service';
import { RefundRequestedEvent } from './refund.service';
import { KafkaDeadLetterPublisher } from '@ticket-booking/event-recovery';

@Injectable()
export class PaymentConsumerLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentConsumerLifecycle.name);
  private readonly consumer: Consumer;
  private connected = false;

  constructor(
    kafka: Kafka,
    @Inject(PAYMENT_CONFIG) private readonly config: PaymentConfig,
    private readonly refunds: RefundService,
    private readonly deadLetter: KafkaDeadLetterPublisher,
  ) {
    this.consumer = kafka.consumer({ groupId: config.kafkaGroupId });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.consumer.connect();
      this.connected = true;
      await this.consumer.subscribe({ topic: 'payment.refund-requested.v1', fromBeginning: true });
      void this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          const raw = message.value?.toString('utf8');
          let payload: unknown = null;
          try {
            if (!raw) throw new Error('Received empty RefundRequested message');
            payload = JSON.parse(raw) as unknown;
            await this.refunds.process(payload as RefundRequestedEvent);
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
          'Payment Kafka consumer stopped unexpectedly',
          error instanceof Error ? error.stack : String(error),
        );
        this.connected = false;
      });
      this.logger.log('Kafka consumer subscribed to payment.refund-requested.v1');
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

