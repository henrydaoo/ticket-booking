import { defaultThresholds, login } from './lib/common.js';
import { mixedFlow } from './lib/flows.js';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '30m', target: 100 },
    { duration: '2m', target: 0 },
  ],
  thresholds: defaultThresholds(),
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  mixedFlow(data.token);
}
