export type ReservationSeat = {
  seatId: string;
  label: string;
  type: string;
  priceVnd: number | null;
};

export type ReservationResponse = {
  reservationId: string;
  customerId: string;
  showtimeId: string;
  status: 'ACTIVE' | 'CANCELLED';
  seatIds: string[];
  seatPrices: Array<{ seatId: string; priceVnd: number }>;
  totalVnd: number;
  expiresAt: string;
};
