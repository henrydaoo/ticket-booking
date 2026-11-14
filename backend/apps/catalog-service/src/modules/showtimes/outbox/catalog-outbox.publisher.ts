import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Producer } from 'kafkajs';
import { CatalogOutboxRepository } from './catalog-outbox.repository';
import { CATALOG_EVENT_PRODUCER } from './catalog-outbox.tokens';

export const SHOWTIME_PUBLISHED_TOPIC = 'catalog.showtime-published.v1';

@Injectable()
export class CatalogOutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CatalogOutboxPublisher.name);
  private connected = false;
  private stopping = false;
  private timer?: NodeJS.Timeout;
  private activeRun?: Promise<void>;

  constructor(
    private readonly repository: CatalogOutboxRepository,
    @Inject(CATALOG_EVENT_PRODUCER) private readonly producer: Producer,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.publishPendingOnce().catch((error: unknown) => {
        this.logger.error(
          'Catalog outbox polling failed',
          error instanceof Error ? error.stack : String(error),
        );
      });
    }, 1000);
    this.timer.unref();
    void this.publishPendingOnce().catch((error: unknown) => {
      this.logger.error(
        'Catalog outbox polling failed',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) {
      clearInterval(this.timer);
    }
    await this.activeRun;
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
    }
  }

  async publishPendingOnce(): Promise<void> {
    if (this.stopping) {
      return;
    }
    if (this.activeRun) {
      return this.activeRun;
    }

    this.activeRun = this.publishBatch();
    try {
      await this.activeRun;
    } finally {
      this.activeRun = undefined;
    }
  }

  private async publishBatch(): Promise<void> {
    if (!this.connected) {
      try {
        await this.producer.connect();
        this.connected = true;
      } catch (error) {
        this.logger.error(
          'Catalog Kafka producer connection failed; outbox events remain pending',
          error instanceof Error ? error.message : String(error),
        );
        return;
      }
    }

    const events = await this.repository.claimOutboxEvents(20);
    for (const event of events) {
      try {
        await this.producer.send({
          topic: SHOWTIME_PUBLISHED_TOPIC,
          messages: [
            {
              key: event.aggregate_id,
              value: JSON.stringify(event.payload),
            },
          ],
        });
        await this.repository.markOutboxPublished(event.event_id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        try {
          await this.repository.markOutboxFailed(
            event.event_id,
            event.attempt_count,
            message,
          );
        } catch (markError) {
          this.logger.error(
            `Failed to reschedule Catalog outbox event ${event.event_id}`,
            markError instanceof Error ? markError.stack : String(markError),
          );
        }
        this.logger.error(
          `Catalog outbox event ${event.event_id} publication failed`,
          message,
        );
      }
    }
  }
}
