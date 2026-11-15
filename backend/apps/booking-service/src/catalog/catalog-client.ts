import {
  HttpException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BOOKING_CONFIG, BookingConfig } from '../config';

export type CatalogShowtime = {
  id: string;
  branchId: string;
  reservationCutoffAt: string;
  bookingEligible: boolean;
  prices: Record<string, number> | null;
};

@Injectable()
export class CatalogClient {
  constructor(@Inject(BOOKING_CONFIG) private readonly config: BookingConfig) {}

  async getPublishedShowtime(showtimeId: string, correlationId?: string): Promise<CatalogShowtime> {
    try {
      const response = await fetch(
        `${this.config.catalogServiceUrl}/showtimes/${encodeURIComponent(showtimeId)}`,
        {
          headers: { 'X-Correlation-Id': correlationId ?? '' },
        },
      );
      const body = await response.text();
      if (!response.ok) {
        throw new HttpException(body || 'Catalog showtime query failed', response.status);
      }
      const showtime = JSON.parse(body) as CatalogShowtime;
      if (
        showtime.id !== showtimeId ||
        typeof showtime.reservationCutoffAt !== 'string' ||
        typeof showtime.bookingEligible !== 'boolean' ||
        !showtime.prices
      ) {
        throw new Error('Catalog returned an invalid showtime contract');
      }
      return showtime;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('Catalog query boundary is unavailable', {
        cause: error,
      });
    }
  }
}
