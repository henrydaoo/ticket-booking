import { defaultThresholds, login } from './lib/common.js';
import { mixedFlow } from './lib/flows.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '30s', target: 500 },
    { duration: '2m', target: 500 },
    { duration: '30s', target: 10 },
    { duration: '30s', target: 0 },
  ],
  thresholds: defaultThresholds(),
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  mixedFlow(data.token);
}
