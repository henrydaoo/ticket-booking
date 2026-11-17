import { sleep } from 'k6';
import { defaultThresholds, login } from './lib/common.js';
import { discoveryFlow, reservationFlow } from './lib/flows.js';

export const options = {
  vus: 1,
  duration: '1m',
  thresholds: defaultThresholds(),
};

export function setup() {
  return { token: login() };
}

export default function (data) {
  discoveryFlow(data.token);
  reservationFlow(data.token, 'baseline');
  sleep(1);
}
