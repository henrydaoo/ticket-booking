import {
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PAYMENT_CONFIG, PaymentConfig } from './config';
import { CORRELATION_ID_HEADER } from './correlation-id.middleware';
import { PaymentPrincipal } from './common/principal';

export type BookingPaymentContext = {
  bookingId: string;
  customerId: string;
  status: 'PENDING_PAYMENT';
  totalVnd: number;
  paymentDeadlineAt: string;
};

@Injectable()
export class BookingClient {
  constructor(@Inject(PAYMENT_CONFIG) private readonly config: PaymentConfig) {}

  async getPaymentContext(
    bookingId: string,
    principal: PaymentPrincipal,
    correlationId?: string,
  ): Promise<BookingPaymentContext> {
    try {
      const response = await fetch(
        `${this.config.bookingServiceUrl}/bookings/${encodeURIComponent(bookingId)}/payment-context`,
        {
          headers: {
            [CORRELATION_ID_HEADER]: correlationId || '',
            'x-authenticated-user-id': principal.userId,
            'x-authenticated-roles': '[]',
            'x-authenticated-branch-ids': '[]',
          },
        },
      );
      const body = await response.text();
      if (!response.ok) throw new HttpException(body, response.status);
      return JSON.parse(body) as BookingPaymentContext;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Booking validation boundary is unavailable', {
        cause: error,
      });
    }
  }
}
