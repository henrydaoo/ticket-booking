import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BOOKING_CONFIG, BookingConfig } from './config';
import { TransactionRunner } from './transaction.runner';
import { BookingRepository } from './booking/booking.repository';

@Injectable()
export class BookingWorkerLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingWorkerLifecycle.name);
  private started = false;
  private timer?: NodeJS.Timeout;
  private activeRun?: Promise<void>;

  constructor(
    @Inject(BOOKING_CONFIG) private readonly config: BookingConfig,
    private readonly transactions: TransactionRunner,
    private readonly repository: BookingRepository,
  ) {}

  onModuleInit(): void {
    this.started = true;
    this.timer = setInterval(() => {
      void this.expireOnce().catch((error: unknown) => {
        this.logger.error(
          'Reservation expiration failed',
          error instanceof Error ? error.stack : String(error),
        );
      });
    }, this.config.reservationExpirationIntervalSeconds * 1000);
    this.timer.unref();
    void this.expireOnce().catch((error: unknown) => {
      this.logger.error(
        'Reservation expiration failed',
        error instanceof Error ? error.stack : String(error),
      );
    });
    this.logger.log('Reservation expiration worker started');
  }

  async onModuleDestroy(): Promise<void> {
    this.started = false;
    if (this.timer) clearInterval(this.timer);
    await this.activeRun;
    this.logger.log('Booking worker lifecycle stopped');
  }

  isStarted(): boolean {
    return this.started;
  }

  private async expireOnce(): Promise<void> {
    if (!this.started || this.activeRun) return this.activeRun;
    this.activeRun = this.transactions
      .run((client) => this.repository.expireDueReservations(client, 100))
      .then((count) => {
        if (count > 0) this.logger.log(`Expired ${count} reservation(s)`);
      })
      .finally(() => {
        this.activeRun = undefined;
      });
    await this.activeRun;
  }
}

