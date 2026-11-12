const assert = require('node:assert/strict');
const test = require('node:test');

test('ticket configuration validates the BookingConfirmed consumer boundary', () => {
  const { loadTicketConfig } = require('../dist/config.js');
  const config = loadTicketConfig({
    SERVICE_NAME: 'ticket-service',
    PORT: '3005',
    DATABASE_URL: 'postgresql://ticket',
    KAFKA_BROKERS: 'localhost:9092',
    KAFKA_CLIENT_ID: 'ticket-service',
    KAFKA_GROUP_ID: 'ticket-foundation',
  });
  assert.equal(config.kafkaGroupId, 'ticket-foundation');
});

