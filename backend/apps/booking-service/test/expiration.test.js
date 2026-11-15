const assert = require('node:assert/strict');
const test = require('node:test');

test('expiration claims only ACTIVE reservations and publishes one expiry event per claim', async () => {
  const { BookingRepository } = require('../dist/booking/booking.repository.js');
  const repository = new BookingRepository();
  const queries = [];
  let step = 0;
  const client = {
    async query(sql) {
      queries.push(sql);
      if (step === 0) {
        step += 1;
        return {
          rows: [{
            id: '11111111-1111-4111-8111-111111111111',
            showtime_id: '22222222-2222-4222-8222-222222222222',
          }],
          rowCount: 1,
        };
      }
      if (sql.includes('FROM reservation_seats')) {
        return {
          rows: [{ seat_id: '33333333-3333-4333-8333-333333333333' }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    },
  };

  assert.equal(await repository.expireDueReservations(client, 100), 1);
  assert.match(queries[0], /status = 'ACTIVE'/);
  assert.doesNotMatch(queries[0], /PAYMENT_PENDING/);
  assert.equal(queries.filter((query) => query.includes('booking_outbox_events')).length, 1);
});
