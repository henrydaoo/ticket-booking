import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { TICKET_CONFIG, TicketConfig } from './config';
import { TicketService } from './tickets/ticket.service';
import { KafkaDeadLetterPublisher } from '@ticket-booking/event-recovery';

export const BOOKING_CONFIRMED_TOPIC = 'booking.booking-confirmed.v1';

@Injectable()
export class TicketConsumerLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TicketConsumerLifecycle.name);
  private readonly consumer: Consumer;
  private connected = false;

  constructor(
    kafka: Kafka,
    @Inject(TICKET_CONFIG) private readonly config: TicketConfig,
    private readonly tickets: TicketService,
    private readonly deadLetter: KafkaDeadLetterPublisher,
  ) {
    this.consumer = kafka.consumer({ groupId: config.kafkaGroupId });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topic: BOOKING_CONFIRMED_TOPIC,
        fromBeginning: true,
      });
      void this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (topic !== BOOKING_CONFIRMED_TOPIC) return;
          const raw = message.value?.toString('utf8');
          let payload: unknown = null;
          try {
            if (!raw) throw new Error(`Received empty Kafka message from ${topic}`);
            payload = JSON.parse(raw) as unknown;
            await this.tickets.processBookingConfirmed(payload);
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
          'Ticket Kafka consumer stopped unexpectedly',
          error instanceof Error ? error.stack : String(error),
        );
        this.connected = false;
      });
      this.connected = true;
      this.logger.log(`Kafka consumer subscribed to ${BOOKING_CONFIRMED_TOPIC}`);
    } catch (error) {
      this.logger.error(
        'Kafka consumer connection failed',
        error instanceof Error ? error.message : String(error),
      );
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

