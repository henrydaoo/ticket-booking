import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentCreation,
  PaymentCreationResult,
  PaymentProviderPort,
  PaymentQueryResult,
  RefundCreation,
  RefundCreationResult,
  VerifiedPaymentCallback,
} from './payment-provider.port';

type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

@Injectable()
export class ResilientPaymentProvider implements PaymentProviderPort {
  private readonly logger = new Logger(ResilientPaymentProvider.name);
  private state: BreakerState = 'CLOSED';
  private failures = 0;
  private openedAt = 0;
  private probeInFlight = false;
  private readonly failureThreshold = 3;
  private readonly cooldownMs = 30_000;
  private readonly timeoutMs = 5_000;
  private readonly maxAttempts = 2;

  constructor(private readonly delegate: PaymentProviderPort) {}

  createPayment(input: PaymentCreation): Promise<PaymentCreationResult> {
    return this.execute(() => this.delegate.createPayment(input));
  }

  verifyCallback(parameters: Record<string, string>): VerifiedPaymentCallback {
    return this.delegate.verifyCallback(parameters);
  }

  queryPayment(input: {
    paymentId: string;
    providerReference: string;
    amountVnd: number;
    transactionDate: Date;
  }): Promise<PaymentQueryResult> {
    return this.execute(() => this.delegate.queryPayment(input));
  }

  createRefund(input: RefundCreation): Promise<RefundCreationResult> {
    return this.execute(() => this.delegate.createRefund(input));
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt < this.cooldownMs) {
        throw new Error('PAYMENT_PROVIDER_CIRCUIT_OPEN');
      }
      this.state = 'HALF_OPEN';
      this.probeInFlight = false;
    }
    if (this.state === 'HALF_OPEN') {
      if (this.probeInFlight) throw new Error('PAYMENT_PROVIDER_CIRCUIT_OPEN');
      this.probeInFlight = true;
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const result = await this.withTimeout(operation());
        this.recordSuccess();
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < this.maxAttempts && this.isRetryable(error)) continue;
        this.recordFailure(error);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('PAYMENT_PROVIDER_UNAVAILABLE');
  }

  private async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error('PAYMENT_PROVIDER_TIMEOUT')), this.timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private isRetryable(error: unknown): boolean {
    return error instanceof Error && [
      'PAYMENT_PROVIDER_TIMEOUT',
      'PROVIDER_UNAVAILABLE',
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
    ].includes(error.message);
  }

  private recordSuccess(): void {
    if (this.state !== 'CLOSED') this.logger.log(`Payment provider circuit ${this.state} -> CLOSED`);
    this.state = 'CLOSED';
    this.failures = 0;
    this.probeInFlight = false;
  }

  private recordFailure(error: unknown): void {
    this.probeInFlight = false;
    this.failures += 1;
    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      this.logger.warn(`Payment provider circuit opened: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
