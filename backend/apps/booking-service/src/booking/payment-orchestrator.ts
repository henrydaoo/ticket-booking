import { Injectable } from '@nestjs/common';
import { TransactionRunner } from '../transaction.runner';
import { BookingRepository, PaymentEvent } from './booking.repository';

@Injectable()
export class PaymentOrchestrator {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly repository: BookingRepository,
  ) {}

  process(event: PaymentEvent): Promise<'duplicate' | 'processed'> {
    return this.transactions.run((client) => this.repository.processPaymentEvent(client, event));
  }
}
