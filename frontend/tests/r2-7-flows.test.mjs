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

test('R2.7 gives booking history its own protected customer page', () => {
  assert.match(read('src/app/(customer)/account/bookings/page.tsx'), /ProtectedRoute/);
  assert.match(read('src/features/tickets/my-tickets-page.tsx'), /useBookingsQuery/);
});

test('R3.1 displays issued customer tickets and QR codes from the Ticket API', () => {
  assert.match(read('src/lib/tickets/ticket-client.ts'), /\/ticket\/tickets/);
  assert.match(read('src/lib/tickets/ticket-queries.ts'), /useQuery/);
  assert.match(read('src/features/tickets/my-tickets-page.tsx'), /useTicketsQuery/);
  assert.match(read('src/features/tickets/my-tickets-page.tsx'), /QRCodeSVG/);
});

test('R3.5 wires staff check-in and manager reversal to approved Ticket routes', () => {
  assert.match(read('src/lib/tickets/check-in-client.ts'), /\/ticket\/check-ins/);
  assert.match(read('src/lib/tickets/check-in-client.ts'), /\/reverse/);
  assert.match(read('src/lib/tickets/check-in-queries.ts'), /useMutation/);
  assert.match(read('src/features/check-in/check-in-page.tsx'), /react-hook-form/);
  assert.match(read('src/features/check-in/check-in-page.tsx'), /TICKET_USED/);
  assert.match(read('src/features/check-in/check-in-page.tsx'), /CHECK_IN_REVERSAL_ROLE_REQUIRED/);
  assert.match(read('src/app/(staff)/staff/check-in/page.tsx'), /ManagerPage view="check-in"/);
});

test('R3.5 presents backend-owned refund statuses without inventing a cancellation action', () => {
  const tickets = read('src/features/tickets/my-tickets-page.tsx');
  assert.match(tickets, /REFUND_PENDING/);
  assert.match(tickets, /REFUNDED/);
  assert.doesNotMatch(tickets, /cancelBooking|cancel.*booking/i);
});
