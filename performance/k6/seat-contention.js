import { defaultThresholds, getSeatId, getShowtimeId, login, authRequest } from './lib/common.js';

export const options = {
  vus: 100,
  iterations: 100,
  thresholds: {
    ...defaultThresholds(),
    request_duration_ms: ['p(95)<800'],
    business_conflicts: ['count>=99'],
  },
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  authRequest(
    'POST',
    '/booking/reservations',
    data.token,
    {
      showtimeId: getShowtimeId(),
      seatIds: [getSeatId()],
      idempotencyKey: `perf-contention-${__VU}-${__ITER}`,
    },
    `perf-contention-${__VU}-${__ITER}`,
  );
}
