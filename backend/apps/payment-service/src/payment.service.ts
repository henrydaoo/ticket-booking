import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PAYMENT_CONFIG, PaymentConfig } from './config';
import { PaymentPrincipal } from './common/principal';
import { BookingClient } from './booking.client';
import { TransactionRunner } from './transaction.runner';
import { PaymentRepository } from './payment.repository';
import { PaymentProviderPort } from './provider/payment-provider.port';
import { PaymentResponse } from './payment.types';

@Injectable()
export class PaymentService {
  constructor(
    private readonly transactions: TransactionRunner,
    private readonly repository: PaymentRepository,
    private readonly bookingClient: BookingClient,
    @Inject('PAYMENT_PROVIDER') private readonly provider: PaymentProviderPort,
    @Inject(PAYMENT_CONFIG) private readonly config: PaymentConfig,
  ) {}

  async create(
    principal: PaymentPrincipal,
    input: { bookingId: string; idempotencyKey: string },
    correlationId: string | undefined,
    clientIp: string,
  ): Promise<PaymentResponse> {
    if (!input.bookingId || !input.idempotencyKey || input.idempotencyKey.length > 200) {
      throw new BadRequestException('bookingId and idempotencyKey are required');
    }

    const existing = await this.transactions.run((client) =>
      this.repository.findByIdempotencyKey(
        client,
        principal.userId,
        input.idempotencyKey,
      ),
    );
    if (existing) {
      if (existing.bookingId !== input.bookingId) {
        throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
      }
      return existing;
    }

    const booking = await this.bookingClient.getPaymentContext(
      input.bookingId,
      principal,
      correlationId,
    );
    const configuredDeadline = new Date(
      Date.now() + this.config.paymentProcessingDeadlineSeconds * 1000,
    );
    const bookingDeadline = new Date(booking.paymentDeadlineAt);
    const processingDeadlineAt =
      bookingDeadline < configuredDeadline ? bookingDeadline : configuredDeadline;
    if (processingDeadlineAt.getTime() <= Date.now()) {
      throw new ConflictException('PAYMENT_DEADLINE_EXPIRED');
    }

    return this.transactions.run(async (client) => {
      const existing = await this.repository.findByIdempotencyKey(
        client,
        principal.userId,
        input.idempotencyKey,
      );
      if (existing) {
        if (existing.bookingId !== input.bookingId) {
          throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
        }
        return existing;
      }

      const paymentId = randomUUID();
      await this.repository.createPending(client, {
        paymentId,
        customerId: principal.userId,
        bookingId: booking.bookingId,
        idempotencyKey: input.idempotencyKey,
        amountVnd: booking.totalVnd,
        processingDeadlineAt,
      });
      const providerPayment = await this.provider.createPayment({
        paymentId,
        amountVnd: booking.totalVnd,
        orderInfo: `Cinema booking ${booking.bookingId}`,
        returnUrl: this.config.vnpayReturnUrl,
        ipnUrl: this.config.vnpayIpnUrl,
        clientIp,
        createdAt: new Date(),
      });
      return this.repository.completeProviderCreation(
        client,
        paymentId,
        providerPayment.providerReference,
        providerPayment.paymentUrl,
      );
    });
  }

  async processWebhook(
    parameters: Record<string, string>,
    correlationId: string,
  ): Promise<{ received: true; duplicate: boolean }> {
    let verified;
    try {
      verified = this.provider.verifyCallback(parameters);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_WEBHOOK_SIGNATURE') {
        throw new BadRequestException('INVALID_WEBHOOK_SIGNATURE');
      }
      throw new BadRequestException('INVALID_WEBHOOK_PAYLOAD');
    }
    const eventId = [
      verified.providerReference,
      parameters.vnp_TransactionNo || 'none',
      verified.responseCode,
    ].join(':');
    let result: 'duplicate' | 'processed';
    try {
      result = await this.transactions.run((client) =>
        this.repository.processWebhook(client, {
          provider: 'VNPAY',
          providerEventId: eventId,
          signature: parameters.vnp_SecureHash,
          payload: parameters,
          providerReference: verified.providerReference,
          amountVnd: verified.amountVnd,
          success: verified.success,
          responseCode: verified.responseCode,
          correlationId,
        }),
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'PAYMENT_NOT_FOUND') {
        throw new NotFoundException('PAYMENT_NOT_FOUND');
      }
      if (error instanceof Error && error.message === 'PAYMENT_AMOUNT_MISMATCH') {
        throw new ConflictException('PAYMENT_AMOUNT_MISMATCH');
      }
      throw error;
    }
    return { received: true, duplicate: result === 'duplicate' };
  }
}
