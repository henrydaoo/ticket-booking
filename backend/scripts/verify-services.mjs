import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serviceNames = [
  'identity-service',
  'catalog-service',
  'booking-service',
  'payment-service',
  'ticket-service',
  'notification-service',
];

for (const serviceName of serviceNames) {
  for (const relativePath of [
    `apps/${serviceName}/package.json`,
    `apps/${serviceName}/src/main.ts`,
  ]) {
    await access(path.join(backendRoot, relativePath));
  }
}

console.log(`Verified ${serviceNames.length} backend services.`);
