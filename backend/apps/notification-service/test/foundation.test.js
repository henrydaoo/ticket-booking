const assert = require('node:assert/strict');
const test = require('node:test');

test('notification configuration validates email-provider boundaries', () => {
  const { loadNotificationConfig } = require('../dist/config.js');
  const config = loadNotificationConfig({
    SERVICE_NAME: 'notification-service',
    PORT: '3006',
    DATABASE_URL: 'postgresql://notification',
    KAFKA_BROKERS: 'localhost:9092',
    KAFKA_CLIENT_ID: 'notification-service',
    KAFKA_GROUP_ID: 'notification-foundation',
    EMAIL_PROVIDER_BASE_URL: 'https://provider',
    EMAIL_PROVIDER_API_KEY: 'deferred',
  });
  assert.equal(config.emailProviderBaseUrl, 'https://provider');
});

