import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

@Injectable()
export class BookingWorkerLifecycle implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingWorkerLifecycle.name);
  private started = false;

  onModuleInit(): void {
    this.started = true;
    this.logger.log(
      'Booking worker lifecycle initialized; reservation expiration behavior is deferred',
    );
  }

  onModuleDestroy(): void {
    this.started = false;
    this.logger.log('Booking worker lifecycle stopped');
  }

  isStarted(): boolean {
    return this.started;
  }
}

