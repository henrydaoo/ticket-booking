import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('R2.7 exposes the customer booking and payment routes', () => {
  assert.equal(fs.existsSync(path.join(root, 'src/app/(customer)/booking/showtimes/[showtimeId]/page.tsx')), true);
  assert.equal(fs.existsSync(path.join(root, 'src/app/(customer)/payment/return/page.tsx')), true);
  assert.match(read('src/lib/booking/booking-client.ts'), /\/booking\/showtimes/);
  assert.match(read('src/lib/booking/booking-client.ts'), /\/payment\/payments/);
});

test('R2.7 uses backend expiry and safe conflict handling', () => {
  const flow = read('src/features/booking/booking-flow.tsx');
  assert.match(flow, /reservation\.expiresAt/);
  assert.match(flow, /\.status === 409/);
  assert.match(flow, /useCancelReservationMutation/);
  assert.match(flow, /react-hook-form/);
});

test('R2.7 adds booking history to the protected account page', () => {
  assert.match(read('src/app/(customer)/account/page.tsx'), /BookingHistory/);
  assert.match(read('src/features/booking/booking-history.tsx'), /useBookingsQuery/);
});
