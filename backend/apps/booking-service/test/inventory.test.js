const assert = require('node:assert/strict');
const test = require('node:test');

const fixture = {
  eventId: '11111111-1111-4111-8111-111111111111',
  eventType: 'ShowtimePublished',
  schemaVersion: 1,
  aggregateType: 'Showtime',
  aggregateId: '22222222-2222-4222-8222-222222222222',
  occurredAt: '2030-01-01T00:00:00.000Z',
  correlationId: 'corr-r2-fixture-001',
  payload: {
    showtimeId: '22222222-2222-4222-8222-222222222222',
    movieId: '33333333-3333-4333-8333-333333333333',
    branchId: '44444444-4444-4444-8444-444444444444',
    screenId: '55555555-5555-4555-8555-555555555555',
    startAt: '2030-01-15T12:00:00.000Z',
    endAt: '2030-01-15T14:00:00.000Z',
    saleOpensAt: '2030-01-01T00:00:00.000Z',
    reservationCutoffAt: '2030-01-15T11:45:00.000Z',
    pricingVersion: 1,
    layoutVersion: 1,
    prices: { STANDARD: 90000, VIP: 120000 },
    seats: [
      { id: '66666666-6666-4666-8666-666666666666', label: 'A1', type: 'STANDARD', row: 'A', number: 1 },
      { id: '77777777-7777-4777-8777-777777777777', label: 'B1', type: 'VIP', row: 'B', number: 1 },
    ],
  },
};

test('parses a valid ShowtimePublished snapshot', () => {
  const { parseShowtimePublishedEvent } = require('../dist/inventory/showtime-published.js');
  const event = parseShowtimePublishedEvent(fixture);
  assert.equal(event.payload.seats.length, 2);
  assert.equal(event.payload.prices.STANDARD, 90000);
});

test('rejects duplicate seats and missing seat prices', () => {
  const { parseShowtimePublishedEvent } = require('../dist/inventory/showtime-published.js');
  assert.throws(
    () => parseShowtimePublishedEvent({
      ...fixture,
      payload: {
        ...fixture.payload,
        seats: [fixture.payload.seats[0], fixture.payload.seats[0]],
      },
    }),
    /unique IDs/,
  );
  assert.throws(
    () => parseShowtimePublishedEvent({
      ...fixture,
      payload: {
        ...fixture.payload,
        prices: { STANDARD: 90000 },
      },
    }),
    /Missing price for seat type VIP/,
  );
});

test('database initialization treats replayed event IDs as duplicates', async () => {
  const { BookingInventoryRepository } = require('../dist/inventory/booking-inventory.repository.js');
  const repository = new BookingInventoryRepository();
  let consumed = false;
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes('INSERT INTO booking_consumed_events')) {
        if (consumed) return { rowCount: 0, rows: [] };
        consumed = true;
        return { rowCount: 1, rows: [{ event_id: fixture.eventId }] };
      }
      if (sql.includes('SELECT screen_id')) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [] };
    },
  };

  assert.equal(await repository.initializeInTransaction(client, fixture), 'initialized');
  assert.equal(await repository.initializeInTransaction(client, fixture), 'duplicate');
  assert.equal(queries.filter((sql) => sql.includes('INSERT INTO showtime_seats')).length, 2);
});
