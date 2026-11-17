const test = require('node:test');
const assert = require('node:assert/strict');

const { createObservability } = require('../dist/index.js');

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
