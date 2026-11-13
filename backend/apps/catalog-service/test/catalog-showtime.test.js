const assert = require('node:assert/strict');
const test = require('node:test');
const {
  CatalogOutboxPublisher,
} = require('../dist/modules/showtimes/outbox/catalog-outbox.publisher.js');
const {
  isShowtimeBookingEligible,
} = require('../dist/modules/showtimes/showtime-eligibility.js');

const startAt = new Date('2030-01-15T12:00:00.000Z');
const saleOpensAt = new Date('2030-01-15T10:00:00.000Z');

test('booking eligibility separates sale opening from the reservation cutoff', () => {
  const eligible = (now, overrides = {}) =>
    isShowtimeBookingEligible({
      status: 'PUBLISHED',
      movieStatus: 'NOW_SHOWING',
      saleOpensAt,
      startAt,
      now: new Date(now),
      ...overrides,
    });

  assert.equal(eligible('2030-01-15T10:00:00.000Z'), true);
  assert.equal(eligible('2030-01-15T11:44:59.999Z'), true);
  assert.equal(eligible('2030-01-15T11:45:00.000Z'), false);
  assert.equal(
    eligible('2030-01-15T10:30:00.000Z', { status: 'DRAFT' }),
    false,
  );
  assert.equal(
    eligible('2030-01-15T10:30:00.000Z', { movieStatus: 'COMING_SOON' }),
    false,
  );
});

test('Outbox retries reuse the same event ID after broker failure', async () => {
  const event = {
    event_id: 'outbox-event-1',
    event_type: 'ShowtimePublished',
    aggregate_id: 'showtime-1',
    attempt_count: 0,
    payload: {
      eventId: 'outbox-event-1',
      eventType: 'ShowtimePublished',
      schemaVersion: 1,
      aggregateType: 'Showtime',
      aggregateId: 'showtime-1',
      occurredAt: '2030-01-01T00:00:00.000Z',
      correlationId: 'correlation-1',
      payload: {
        showtimeId: 'showtime-1',
        seats: [],
      },
    },
  };
  let attemptCount = 0;
  let published = false;
  let failFirstSend = true;
  const publishedEvents = [];
  const failedEvents = [];
  const repository = {
    async claimOutboxEvents() {
      if (published) {
        return [];
      }
      attemptCount += 1;
      return [{ ...event, attempt_count: attemptCount }];
    },
    async markOutboxPublished(eventId) {
      assert.equal(eventId, event.event_id);
      published = true;
    },
    async markOutboxFailed(eventId, attempts, message) {
      failedEvents.push({ eventId, attempts, message });
    },
  };
  const producer = {
    async connect() {},
    async disconnect() {},
    async send(request) {
      publishedEvents.push(JSON.parse(request.messages[0].value));
      if (failFirstSend) {
        failFirstSend = false;
        throw new Error('temporary broker failure');
      }
    },
  };
  const publisher = new CatalogOutboxPublisher(repository, producer);
  publisher.logger = { error() {} };

  await publisher.publishPendingOnce();
  assert.equal(published, false);
  assert.equal(failedEvents.length, 1);
  assert.equal(failedEvents[0].eventId, event.event_id);

  await publisher.publishPendingOnce();
  await publisher.onModuleDestroy();

  assert.equal(published, true);
  assert.equal(publishedEvents.length, 2);
  assert.equal(publishedEvents[0].eventId, publishedEvents[1].eventId);
});
