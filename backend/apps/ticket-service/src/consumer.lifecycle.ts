import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { TICKET_CONFIG, TicketConfig } from './config';
import { TicketService } from './tickets/ticket.service';

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
        eachMessage: async ({ topic, message }) => {
          if (topic !== BOOKING_CONFIRMED_TOPIC) return;
          if (!message.value) throw new Error(`Received empty Kafka message from ${topic}`);
          await this.tickets.processBookingConfirmed(
            JSON.parse(message.value.toString('utf8')) as unknown,
          );
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
  }

  isConnected(): boolean {
    return this.connected;
  }
}

