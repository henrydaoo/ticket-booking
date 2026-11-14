export type BookingSeat = {
  seatId: string;
  priceVnd: number;
};

export type BookingResponse = {
  bookingId: string;
  reservationId: string;
  customerId: string;
  showtimeId: string;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED';
  seats: BookingSeat[];
  totalVnd: number;
  paymentDeadlineAt: string;
};
