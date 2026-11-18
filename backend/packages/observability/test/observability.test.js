const test = require('node:test');
const assert = require('node:assert/strict');

const { createObservability, parseOtelHeaders } = require('../dist/index.js');

test('creates isolated metrics registry with HTTP instruments', async () => {
  const observability = createObservability('test-service');

  observability.httpRequests.inc({
    method: 'GET',
    route: '/health',
    status: '200',
  });

  const metrics = await observability.registry.metrics();
  assert.match(metrics, /ticket_booking_http_requests_total/);
  assert.match(metrics, /route="\/health"/);
});

test('parses URL-encoded OTLP headers', () => {
  assert.deepEqual(
    parseOtelHeaders('Authorization=Basic%20token, x-scope-orgid=moonlight'),
    {
      Authorization: 'Basic token',
      'x-scope-orgid': 'moonlight',
    },
  );
});

test('rejects malformed OTLP headers', () => {
  assert.throws(
    () => parseOtelHeaders('Authorization'),
    /comma-separated key=value pairs/,
  );
});
