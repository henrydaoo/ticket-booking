import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { BOOKING_CONFIG, BookingConfig } from '../config';

@Injectable()
export class BookingPaymentClient {
  constructor(@Inject(BOOKING_CONFIG) private readonly config: BookingConfig) {}

  async createPayment(input: {
    bookingId: string;
    customerId: string;
    idempotencyKey: string;
    correlationId?: string;
    clientIp: string;
  }): Promise<{ paymentId: string; bookingId: string; paymentUrl: string }> {
    try {
      const response = await fetch(`${this.config.paymentServiceUrl}/payments/internal`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-service-secret': this.config.internalServiceSecret,
          'x-authenticated-user-id': input.customerId,
          'x-correlation-id': input.correlationId || '',
        },
        body: JSON.stringify({
          bookingId: input.bookingId,
          idempotencyKey: input.idempotencyKey,
          clientIp: input.clientIp,
        }),
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`PAYMENT_INITIATION_FAILED:${response.status}:${body}`);
      return JSON.parse(body) as { paymentId: string; bookingId: string; paymentUrl: string };
    } catch (error) {
      throw new ServiceUnavailableException('Payment initiation boundary is unavailable', {
        cause: error,
      });
    }
  }
}
