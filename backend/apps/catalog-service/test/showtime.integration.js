const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const { TransactionRunner } = require('../dist/infrastructure/database/transaction.runner');
const { CatalogOutboxPublisher } = require('../dist/modules/showtimes/outbox/catalog-outbox.publisher');
const { CatalogOutboxRepository } = require('../dist/modules/showtimes/outbox/catalog-outbox.repository');
const {
  cleanupFixture,
  createDraft,
  createFixture,
  managerHeaders,
  newFixture,
  setPrices,
  showtimeInput,
  startCatalog,
} = require('./catalog-test-support');

let context;
let fixture;

test.beforeEach(async () => {
  context = await startCatalog();
  fixture = newFixture();
  await createFixture(context, fixture);
});

test.afterEach(async () => {
  if (context) {
    try {
      await cleanupFixture(context, fixture);
    } finally {
      await context.close();
      context = undefined;
    }
  }
});

function interval(hoursFromNow = 2) {
  const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  return { start, end: new Date(start.getTime() + 90 * 60 * 1000) };
}

function publish(id, correlationId) {
  return context.request(`/showtimes/${id}/publish`, {
    method: 'POST',
    headers: {
      ...managerHeaders(fixture.branchId),
      ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
    },
    body: JSON.stringify({}),
  });
}

test('draft showtimes are editable and visible only to managers of their branch', async () => {
  const { start, end } = interval();
  const draft = await createDraft(context, fixture, start, end);
  assert.equal(draft.status, 201);
  assert.equal(draft.body.status, 'DRAFT');

  const ownDrafts = await context.request('/showtimes/drafts', {
    headers: managerHeaders(fixture.branchId),
  });
  assert.equal(ownDrafts.status, 200);
  assert.equal(ownDrafts.body.some((showtime) => showtime.id === draft.body.id), true);

  const otherDrafts = await context.request('/showtimes/drafts', {
    headers: managerHeaders(randomUUID()),
  });
  assert.equal(otherDrafts.status, 200);
  assert.equal(otherDrafts.body.some((showtime) => showtime.id === draft.body.id), false);

  const adjustedStart = new Date(start.getTime() + 60 * 1000);
  const adjusted = await context.request(`/showtimes/${draft.body.id}`, {
    method: 'PATCH',
    headers: managerHeaders(fixture.branchId),
    body: JSON.stringify({ startAt: adjustedStart.toISOString() }),
  });
  assert.equal(adjusted.status, 200);
  assert.equal(adjusted.body.startAt, adjustedStart.toISOString());

  const publicList = await context.request(`/showtimes?movieId=${fixture.movieId}`);
  assert.equal(publicList.status, 200);
  assert.equal(publicList.body.some((showtime) => showtime.id === draft.body.id), false);
});

test('showtime creation rejects another branch and timestamps without offsets', async () => {
  const { start, end } = interval();
  const unauthorized = await context.request('/showtimes', {
    method: 'POST',
    headers: managerHeaders(randomUUID()),
    body: JSON.stringify(showtimeInput(fixture, start, end)),
  });
  assert.equal(unauthorized.status, 403);

  const invalid = await context.request('/showtimes', {
    method: 'POST',
    headers: managerHeaders(fixture.branchId),
    body: JSON.stringify({ ...showtimeInput(fixture, start, end), startAt: start.toISOString().slice(0, -1) }),
  });
  assert.equal(invalid.status, 400);
});

test('publication records a layout and price snapshot and remains visible before sale opening', async () => {
  const { start, end } = interval();
  const saleOpensAt = new Date(Date.now() + 60 * 60 * 1000);
  const draft = await createDraft(context, fixture, start, end, saleOpensAt);
  assert.equal(draft.status, 201);
  const correlationId = `integration-${fixture.tag}`;
  const result = await publish(draft.body.id, correlationId);
  assert.equal(result.status, 201);
  assert.equal(result.body.status, 'PUBLISHED');
  assert.equal(result.body.discoveryVisible, true);
  assert.equal(result.body.bookingEligible, false);
  assert.equal(result.body.prices.STANDARD, 90000);
  assert.equal(result.body.pricingVersion, fixture.pricingVersion);
  assert.equal(result.body.seats.length, 2);
  assert.equal(
    result.body.reservationCutoffAt,
    new Date(start.getTime() - 15 * 60 * 1000).toISOString(),
  );
  const outbox = await context.database.query(
    'SELECT event_id, payload, status FROM catalog_outbox_events WHERE aggregate_id = $1',
    [draft.body.id],
  );
  assert.equal(outbox.rowCount, 1);
  assert.equal(outbox.rows[0].status, 'PENDING');
  const event = outbox.rows[0].payload;
  assert.equal(event.eventType, 'ShowtimePublished');
  assert.equal(event.correlationId, correlationId);
  assert.equal(event.eventId, outbox.rows[0].event_id);
  assert.equal(event.payload.layoutVersion, fixture.layoutVersion);
  assert.equal(event.payload.pricingVersion, fixture.pricingVersion);
  assert.equal(event.payload.seats.length, 2);
});

test('published layout is protected and price snapshots do not change with later screen prices', async () => {
  const { start, end } = interval();
  const first = await createDraft(context, fixture, start, end);
  assert.equal(first.status, 201);
  assert.equal((await publish(first.body.id)).status, 201);

  const layout = await context.request(`/screens/${fixture.screenId}/layout`, {
    method: 'PUT',
    headers: managerHeaders(fixture.branchId),
    body: JSON.stringify({
      seats: [
        { label: 'A1', type: 'STANDARD', row: 'A', number: 1 },
        { label: 'A2', type: 'STANDARD', row: 'A', number: 2 },
      ],
    }),
  });
  assert.equal(layout.status, 409);

  const changed = await setPrices(context, fixture, 100000, 140000);
  assert.equal(changed.status, 200);
  const read = await context.request(`/showtimes/${first.body.id}`);
  assert.equal(read.status, 200);
  assert.equal(read.body.prices.STANDARD, 90000);
  assert.equal(read.body.pricingVersion, fixture.pricingVersion);

  const secondStart = new Date(end.getTime() + 30 * 60 * 1000);
  const secondEnd = new Date(secondStart.getTime() + 90 * 60 * 1000);
  const second = await createDraft(
    context,
    fixture,
    secondStart,
    secondEnd,
    new Date(Date.now() - 60 * 1000),
  );
  assert.equal(second.status, 201);
  const published = await publish(second.body.id);
  assert.equal(published.status, 201);
  assert.equal(published.body.bookingEligible, true);
  assert.equal(published.body.prices.STANDARD, 100000);
  assert.equal(published.body.pricingVersion, changed.body.pricingVersion);
});

test('showtimes require at least a 30-minute screen buffer', async () => {
  const { start, end } = interval();
  const first = await createDraft(context, fixture, start, end);
  assert.equal(first.status, 201);
  const tooClose = await createDraft(
    context,
    fixture,
    new Date(end.getTime() + 29 * 60 * 1000),
    new Date(end.getTime() + 119 * 60 * 1000),
  );
  assert.equal(tooClose.status, 409);
  const exactlyThirty = await createDraft(
    context,
    fixture,
    new Date(end.getTime() + 30 * 60 * 1000),
    new Date(end.getTime() + 120 * 60 * 1000),
  );
  assert.equal(exactlyThirty.status, 201);
});

test('concurrent conflicting showtime creation commits only one draft', async () => {
  const { start, end } = interval();
  const results = await Promise.all([
    createDraft(context, fixture, start, end),
    createDraft(context, fixture, start, end),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
});

test('publication rejects missing seat-type prices without changing the draft', async () => {
  const { start, end } = interval();
  const draft = await createDraft(context, fixture, start, end);
  assert.equal(draft.status, 201);
  const prices = await context.request(`/screens/${fixture.screenId}/prices`, {
    method: 'PUT',
    headers: managerHeaders(fixture.branchId),
    body: JSON.stringify({ prices: [{ seatType: 'VIP', priceVnd: 140000 }] }),
  });
  assert.equal(prices.status, 200);
  assert.equal((await publish(draft.body.id)).status, 409);
  const state = await context.database.query('SELECT status FROM showtimes WHERE id = $1', [draft.body.id]);
  assert.equal(state.rows[0].status, 'DRAFT');
});

test('publication rolls back showtime and outbox when outbox insertion fails', async () => {
  const { start, end } = interval();
  const draft = await createDraft(context, fixture, start, end);
  assert.equal(draft.status, 201);
  const name = `catalog_test_${randomUUID().replaceAll('-', '')}`;
  const functionName = `${name}_fn`;
  try {
    await context.database.query(`
      CREATE FUNCTION ${functionName}() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.aggregate_id = '${draft.body.id}'::uuid THEN
          RAISE EXCEPTION 'injected outbox failure';
        END IF;
        RETURN NEW;
      END;
      $$`);
    await context.database.query(`
      CREATE TRIGGER ${name}
      BEFORE INSERT ON catalog_outbox_events
      FOR EACH ROW EXECUTE FUNCTION ${functionName}()`);
    assert.equal((await publish(draft.body.id)).status, 500);
    const state = await context.database.query('SELECT status FROM showtimes WHERE id = $1', [draft.body.id]);
    assert.equal(state.rows[0].status, 'DRAFT');
    const outbox = await context.database.query(
      'SELECT 1 FROM catalog_outbox_events WHERE aggregate_id = $1',
      [draft.body.id],
    );
    assert.equal(outbox.rowCount, 0);
  } finally {
    await context.database.query(`DROP TRIGGER IF EXISTS ${name} ON catalog_outbox_events`);
    await context.database.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
  }
});

test('publication defaults sale opening to its publication time', async () => {
  const { start, end } = interval();
  const draft = await createDraft(context, fixture, start, end);
  assert.equal(draft.status, 201);
  assert.equal((await publish(draft.body.id)).status, 201);
  const result = await context.database.query(
    'SELECT sale_opens_at, published_at FROM showtimes WHERE id = $1',
    [draft.body.id],
  );
  assert.equal(result.rows[0].sale_opens_at.toISOString(), result.rows[0].published_at.toISOString());
});

test('outbox retry publishes the same event ID after a simulated broker failure', async () => {
  const { start, end } = interval();
  const draft = await createDraft(context, fixture, start, end);
  assert.equal(draft.status, 201);
  assert.equal((await publish(draft.body.id)).status, 201);
  const unrelated = await context.database.query(
    `SELECT 1 FROM catalog_outbox_events
     WHERE status <> 'PUBLISHED' AND aggregate_id <> $1 LIMIT 1`,
    [draft.body.id],
  );
  assert.equal(unrelated.rowCount, 0, 'Test database contains unrelated pending outbox events');

  let failOnce = true;
  const sent = [];
  const producer = {
    async connect() {},
    async disconnect() {},
    async send(message) {
      sent.push(JSON.parse(message.messages[0].value));
      if (failOnce) {
        failOnce = false;
        throw new Error('injected Kafka send failure');
      }
    },
  };
  const repository = new CatalogOutboxRepository(
    context.database,
    new TransactionRunner(context.database),
  );
  const publisher = new CatalogOutboxPublisher(repository, producer);
  try {
    await publisher.publishPendingOnce();
    const retryable = await context.database.query(
      'SELECT event_id, status FROM catalog_outbox_events WHERE aggregate_id = $1',
      [draft.body.id],
    );
    assert.equal(retryable.rows[0].status, 'PENDING');
    await context.database.query(
      'UPDATE catalog_outbox_events SET next_attempt_at = NOW() WHERE aggregate_id = $1',
      [draft.body.id],
    );
    await publisher.publishPendingOnce();
    const delivered = await context.database.query(
      'SELECT event_id, status FROM catalog_outbox_events WHERE aggregate_id = $1',
      [draft.body.id],
    );
    assert.equal(delivered.rows[0].status, 'PUBLISHED');
    assert.equal(sent.length, 2);
    assert.equal(sent[0].eventId, sent[1].eventId);
    assert.equal(sent[0].eventId, delivered.rows[0].event_id);
  } finally {
    await publisher.onModuleDestroy();
  }
});
