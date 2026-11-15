const assert = require('node:assert/strict');
const test = require('node:test');
const {
  ConfigurationError,
  loadServiceConfig,
  loadKafkaSecurityOptions,
} = require('../dist/index.js');

test('loads independent gateway configuration', () => {
  assert.deepEqual(
    loadServiceConfig({
      SERVICE_NAME: 'api-gateway',
      PORT: '3000',
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
    }),
    {
      serviceName: 'api-gateway',
      port: 3000,
      nodeEnvironment: 'development',
      logLevel: 'debug',
    },
  );
});

test('loads independent identity service configuration', () => {
  assert.deepEqual(
    loadServiceConfig({
      SERVICE_NAME: 'identity-service',
      PORT: '3001',
    }),
    {
      serviceName: 'identity-service',
      port: 3001,
      nodeEnvironment: 'development',
      logLevel: 'info',
    },
  );
});

test('rejects missing required configuration', () => {
  assert.throws(
    () => loadServiceConfig({ SERVICE_NAME: 'catalog-service' }),
    new ConfigurationError('Missing required environment variable: PORT'),
  );
});

test('rejects invalid ports without exposing configuration values', () => {
  assert.throws(
    () =>
      loadServiceConfig({
        SERVICE_NAME: 'booking-service',
        PORT: 'not-a-port',
      }),
    new ConfigurationError('PORT must be an integer between 1 and 65535'),
  );
});

test('loads Kafka SASL security options for a managed broker', () => {
  assert.deepEqual(
    loadKafkaSecurityOptions({
      KAFKA_USERNAME: 'avnadmin',
      KAFKA_PASSWORD: 'secret',
      KAFKA_SASL_MECHANISM: 'scram-sha-256',
    }),
    {
      ssl: true,
      sasl: {
        mechanism: 'scram-sha-256',
        username: 'avnadmin',
        password: 'secret',
      },
    },
  );
});

test('keeps local Kafka configuration without SASL options', () => {
  assert.deepEqual(loadKafkaSecurityOptions({ KAFKA_BROKERS: 'localhost:9092' }), {});
});

test('rejects incomplete Kafka SASL credentials', () => {
  assert.throws(
    () => loadKafkaSecurityOptions({ KAFKA_USERNAME: 'avnadmin' }),
    new ConfigurationError('KAFKA_USERNAME and KAFKA_PASSWORD must be provided together'),
  );
});

