const assert = require('node:assert/strict');
const test = require('node:test');

const reservationId = '22222222-2222-4222-8222-222222222222';
const principal = { userId: 'user-customer-001', roles: ['CUSTOMER'], branchIds: [] };

test('booking creation uses the reservation snapshot and payment deadline', async () => {
  const { BookingService } = require('../dist/booking/booking.service.js');
  let captured;
  const service = new BookingService(
    { async run(work) { return work({}); } },
    {
      async findByIdempotencyKey() { return null; },
      async createFromReservation(_client, input) {
        captured = input;
        return {
          bookingId: input.bookingId,
          reservationId: input.reservationId,
          customerId: input.customerId,
          showtimeId: '33333333-3333-4333-8333-333333333333',
          status: 'PENDING_PAYMENT',
          seats: [{ seatId: '44444444-4444-4444-8444-444444444444', priceVnd: 90000 }],
          totalVnd: 90000,
          paymentDeadlineAt: input.paymentDeadlineAt.toISOString(),
        };
      },
    },
    { paymentProcessingDeadlineSeconds: 300 },
  );
  const result = await service.create(principal, {
    reservationId,
    idempotencyKey: 'booking-001',
  });

  assert.equal(result.status, 'PENDING_PAYMENT');
  assert.equal(result.totalVnd, 90000);
  assert.equal(captured.reservationId, reservationId);
  assert.ok(captured.paymentDeadlineAt.getTime() > Date.now());
});

test('booking idempotency does not create a second booking', async () => {
  const { BookingService } = require('../dist/booking/booking.service.js');
  let createCount = 0;
  const existing = {
    bookingId: '55555555-5555-4555-8555-555555555555',
    reservationId,
    customerId: principal.userId,
    showtimeId: '33333333-3333-4333-8333-333333333333',
    status: 'PENDING_PAYMENT',
    seats: [],
    totalVnd: 0,
    paymentDeadlineAt: '2030-01-15T12:10:00.000Z',
  };
  const service = new BookingService(
    { async run(work) { return work({}); } },
    {
      async findByIdempotencyKey() { return existing; },
      async createFromReservation() { createCount += 1; throw new Error('must not create'); },
    },
    { paymentProcessingDeadlineSeconds: 300 },
  );

  assert.deepEqual(
    await service.create(principal, { reservationId, idempotencyKey: 'booking-002' }),
    existing,
  );
  assert.equal(createCount, 0);
});
