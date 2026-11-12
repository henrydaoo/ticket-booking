const assert = require('node:assert/strict');
const test = require('node:test');

test('payment configuration validates provider and Kafka boundaries', () => {
  const { loadPaymentConfig } = require('../dist/config.js');
  const config = loadPaymentConfig({
    SERVICE_NAME: 'payment-service',
    PORT: '3004',
    DATABASE_URL: 'postgresql://payment',
    KAFKA_BROKERS: 'localhost:9092',
    KAFKA_CLIENT_ID: 'payment-service',
    KAFKA_GROUP_ID: 'payment-foundation',
    PAYMENT_PROVIDER_BASE_URL: 'https://provider',
    PAYMENT_PROVIDER_API_KEY: 'deferred',
  });
  assert.equal(config.providerBaseUrl, 'https://provider');
  assert.deepEqual(config.kafkaBrokers, ['localhost:9092']);
});

