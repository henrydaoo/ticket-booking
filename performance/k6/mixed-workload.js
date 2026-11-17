import { defaultThresholds, login } from './lib/common.js';
import { mixedFlow } from './lib/flows.js';

export const options = {
  stages: [
    { duration: '2m', target: 500 },
    { duration: '5m', target: 500 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    ...defaultThresholds(),
    request_duration_ms: ['p(95)<800'],
  },
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  mixedFlow(data.token);
}
