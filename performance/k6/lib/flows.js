import { sleep } from 'k6';
import {
  authRequest,
  getSeatId,
  getShowtimeId,
} from './common.js';

export function discoveryFlow(token) {
  authRequest('GET', '/catalog/movies', token);
  authRequest('GET', '/catalog/showtimes', token);
  authRequest('GET', `/booking/showtimes/${getShowtimeId()}/seats`, token);
}

export function reservationFlow(token, suffix) {
  return authRequest(
    'POST',
    '/booking/reservations',
    token,
    {
      showtimeId: getShowtimeId(),
      seatIds: [getSeatId()],
      idempotencyKey: `perf-reservation-${__VU}-${__ITER}-${suffix}`,
    },
    `perf-reservation-${__VU}-${__ITER}-${suffix}`,
  );
}

export function accountFlow(token) {
  authRequest('GET', '/booking/bookings', token);
  authRequest('GET', '/ticket/tickets', token);
}

export function mixedFlow(token) {
  const selector = Math.random();
  if (selector < 0.45) {
    discoveryFlow(token);
  } else if (selector < 0.7) {
    authRequest('GET', `/booking/showtimes/${getShowtimeId()}/seats`, token);
  } else if (selector < 0.85) {
    reservationFlow(token, `mixed-${Date.now()}`);
  } else {
    accountFlow(token);
  }
  sleep(0.1);
}
