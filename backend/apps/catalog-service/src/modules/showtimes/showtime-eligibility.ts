import { MovieStatusValue, ShowtimeStatus } from './showtime.types';

export function isShowtimeBookingEligible(input: {
  status: ShowtimeStatus;
  movieStatus: MovieStatusValue;
  saleOpensAt: Date;
  startAt: Date;
  now: Date;
}): boolean {
  const reservationCutoffAt = input.startAt.getTime() - 15 * 60 * 1000;

  return (
    input.status === 'PUBLISHED' &&
    input.movieStatus === 'NOW_SHOWING' &&
    input.now.getTime() >= input.saleOpensAt.getTime() &&
    input.now.getTime() < reservationCutoffAt
  );
}
