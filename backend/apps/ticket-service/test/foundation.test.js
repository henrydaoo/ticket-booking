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
    TICKET_QR_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
  });
  assert.equal(config.kafkaGroupId, 'ticket-foundation');
  assert.equal(config.qrTokenEncryptionKey.length, 32);
});

test('ticket configuration rejects weak or malformed QR token encryption keys', () => {
  const { loadTicketConfig } = require('../dist/config.js');
  assert.throws(
    () =>
      loadTicketConfig({
        SERVICE_NAME: 'ticket-service',
        PORT: '3005',
        DATABASE_URL: 'postgresql://ticket',
        KAFKA_BROKERS: 'localhost:9092',
        KAFKA_CLIENT_ID: 'ticket-service',
        KAFKA_GROUP_ID: 'ticket-foundation',
        TICKET_QR_TOKEN_ENCRYPTION_KEY: 'too-short',
      }),
    /TICKET_QR_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key/,
  );
});

