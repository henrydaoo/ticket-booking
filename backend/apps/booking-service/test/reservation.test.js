const assert = require('node:assert/strict');
const test = require('node:test');

const showtimeId = '22222222-2222-4222-8222-222222222222';
const seatA = '66666666-6666-4666-8666-666666666666';
const seatB = '77777777-7777-4777-8777-777777777777';
const principal = { userId: 'user-customer-001', roles: ['CUSTOMER'], branchIds: [] };

function serviceWith(overrides = {}) {
  const { ReservationService } = require('../dist/reservation/reservation.service.js');
  return new ReservationService(
    overrides.catalog || {
      async getPublishedShowtime() {
        return {
          id: showtimeId,
          branchId: '44444444-4444-4444-8444-444444444444',
          reservationCutoffAt: '2030-01-15T11:45:00.000Z',
          bookingEligible: true,
          prices: { STANDARD: 90000, VIP: 120000 },
        };
      },
    },
    overrides.transactions || {
      async run(work) {
        return work({});
      },
    },
    overrides.repository || {
      async findByIdempotencyKey() {
        return null;
      },
      async createReservation(_client, input) {
        return {
          reservationId: input.reservationId,
          customerId: input.customerId,
          showtimeId: input.showtimeId,
          status: 'ACTIVE',
          seatIds: input.seatIds,
          seatPrices: input.seatIds.map((seatId) => ({ seatId, priceVnd: 90000 })),
          totalVnd: input.seatIds.length * 90000,
          expiresAt: input.expiresAt.toISOString(),
        };
      },
    },
    { reservationDurationSeconds: 300 },
  );
}

test('reservation creation passes one transaction and backend expiry', async () => {
  let transactionCount = 0;
  const service = serviceWith({
    transactions: {
      async run(work) {
        transactionCount += 1;
        return work({});
      },
    },
  });
  const result = await service.create(
    principal,
    { showtimeId, seatIds: [seatA, seatB], idempotencyKey: 'reserve-001' },
  );

  assert.equal(transactionCount, 1);
  assert.equal(result.status, 'ACTIVE');
  assert.equal(result.seatIds.length, 2);
  assert.ok(new Date(result.expiresAt).getTime() > Date.now());
});

test('reservation rejects an ineligible showtime before opening a transaction', async () => {
  let transactionStarted = false;
  const service = serviceWith({
    catalog: {
      async getPublishedShowtime() {
        return {
          id: showtimeId,
          branchId: '44444444-4444-4444-8444-444444444444',
          reservationCutoffAt: '2030-01-15T11:45:00.000Z',
          bookingEligible: false,
          prices: { STANDARD: 90000 },
        };
      },
    },
    transactions: {
      async run() {
        transactionStarted = true;
        throw new Error('transaction should not start');
      },
    },
  });

  await assert.rejects(
    () => service.create(principal, { showtimeId, seatIds: [seatA], idempotencyKey: 'reserve-002' }),
    /SHOWTIME_NOT_BOOKABLE/,
  );
  assert.equal(transactionStarted, false);
});

test('reservation rejects duplicate seat selection at the boundary', async () => {
  const service = serviceWith();
  await assert.rejects(
    () => service.create(principal, { showtimeId, seatIds: [seatA, seatA], idempotencyKey: 'reserve-003' }),
    /seatIds must be unique/,
  );
});
