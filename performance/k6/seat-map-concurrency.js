import { defaultThresholds, getShowtimeId, login, authRequest } from './lib/common.js';

export const options = {
  vus: 1000,
  iterations: 1000,
  thresholds: {
    ...defaultThresholds(),
    request_duration_ms: ['p(95)<500'],
  },
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  authRequest('GET', `/booking/showtimes/${getShowtimeId()}/seats`, data.token);
}
