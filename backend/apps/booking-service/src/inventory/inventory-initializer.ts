import { Injectable, Logger } from '@nestjs/common';
import { TransactionRunner } from '../transaction.runner';
import { BookingInventoryRepository, InventoryInitializationResult } from './booking-inventory.repository';
import { parseShowtimePublishedEvent, ShowtimePublishedEvent } from './showtime-published';

@Injectable()
export class InventoryInitializer {
  private readonly logger = new Logger(InventoryInitializer.name);

  constructor(
    private readonly transactionRunner: TransactionRunner,
    private readonly repository: BookingInventoryRepository,
  ) {}

  async initialize(value: unknown): Promise<InventoryInitializationResult> {
    const event: ShowtimePublishedEvent = parseShowtimePublishedEvent(value);
    const result = await this.transactionRunner.run((client) =>
      this.repository.initializeInTransaction(client, event),
    );
    this.logger.log(
      `Showtime inventory ${result} for ${event.payload.showtimeId} from event ${event.eventId}`,
    );
    return result;
  }
}
