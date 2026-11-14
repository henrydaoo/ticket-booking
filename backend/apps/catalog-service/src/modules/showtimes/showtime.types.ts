import { SeatType } from '../screens/dto/screen.dto';

export type ShowtimeStatus = 'DRAFT' | 'PUBLISHED';

export type PhysicalSeat = {
  id: string;
  label: string;
  type: SeatType;
  row: string;
  number: number;
};

export type ShowtimePrices = Partial<Record<SeatType, number>>;

export type ShowtimeResponse = {
  id: string;
  movieId: string;
  movieStatus: MovieStatusValue;
  branchId: string;
  screenId: string;
  startAt: string;
  endAt: string;
  saleOpensAt: string | null;
  reservationCutoffAt: string;
  status: ShowtimeStatus;
  discoveryVisible: boolean;
  bookingEligible: boolean;
  prices: ShowtimePrices | null;
  pricingVersion: number | null;
  layoutVersion: number | null;
  seats: PhysicalSeat[] | null;
};

export type MovieStatusValue = 'COMING_SOON' | 'NOW_SHOWING' | 'ENDED';

export type ShowtimeEvent = {
  eventId: string;
  eventType: 'ShowtimePublished';
  schemaVersion: 1;
  aggregateType: 'Showtime';
  aggregateId: string;
  occurredAt: string;
  correlationId: string;
  payload: {
    showtimeId: string;
    movieId: string;
    branchId: string;
    screenId: string;
    startAt: string;
    endAt: string;
    saleOpensAt: string;
    reservationCutoffAt: string;
    prices: ShowtimePrices;
    pricingVersion: number;
    layoutVersion: number;
    seats: PhysicalSeat[];
  };
};
