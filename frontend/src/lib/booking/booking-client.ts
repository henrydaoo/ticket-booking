import { apiRequest } from '@/lib/api-client/client';

export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED';

export type Seat = {
  seatId: string;
  label: string;
  type: 'STANDARD' | 'VIP' | 'COUPLE';
  priceVnd: number;
  status: SeatStatus;
};

export type SeatMap = {
  showtimeId: string;
  inventoryReady: boolean;
  reservationCutoffAt: string;
  seats: Seat[];
};

export type Reservation = {
  reservationId: string;
  customerId: string;
  showtimeId: string;
  status: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PAYMENT_PENDING' | 'CONFIRMED';
  seatIds: string[];
  seatPrices: Array<{ seatId: string; priceVnd: number }>;
  totalVnd: number;
  expiresAt: string;
};

export type BookingSeat = { seatId: string; priceVnd: number };

export type Booking = {
  bookingId: string;
  reservationId: string;
  showtimeId: string;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED';
  seats: BookingSeat[];
  totalVnd: number;
  paymentDeadlineAt: string;
};

export type Payment = {
  paymentId: string;
  bookingId: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED';
  amountVnd: number;
  provider: 'VNPAY';
  paymentUrl: string;
  processingDeadlineAt: string;
};

export function getSeatMap(showtimeId: string): Promise<SeatMap> {
  return apiRequest<SeatMap>(`/booking/showtimes/${encodeURIComponent(showtimeId)}/seats`);
}

export function createReservation(input: {
  showtimeId: string;
  seatIds: string[];
  idempotencyKey: string;
}): Promise<Reservation> {
  return apiRequest<Reservation>('/booking/reservations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function cancelReservation(reservationId: string): Promise<unknown> {
  return apiRequest(`/booking/reservations/${encodeURIComponent(reservationId)}/cancel`, {
    method: 'POST',
  });
}

export function createBooking(input: {
  reservationId: string;
  idempotencyKey: string;
}): Promise<Booking> {
  return apiRequest<Booking>('/booking/bookings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listBookings(): Promise<Booking[]> {
  return apiRequest<Booking[]>('/booking/bookings');
}

export function createPayment(input: {
  bookingId: string;
  idempotencyKey: string;
}): Promise<Payment> {
  return apiRequest<Payment>('/payment/payments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getPayment(paymentId: string): Promise<Payment> {
  return apiRequest<Payment>(`/payment/payments/${encodeURIComponent(paymentId)}`);
}
