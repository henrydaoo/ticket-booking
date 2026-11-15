const assert = require('node:assert/strict');
const test = require('node:test');

const baseEnvironment = {
  SERVICE_NAME: 'identity-service',
  PORT: '3001',
  DATABASE_URL: 'postgresql://identity',
  JWT_ISSUER: 'issuer',
  JWT_AUDIENCE: 'audience',
  JWT_KEY_ID: 'key',
  JWT_PRIVATE_KEY_PATH: 'private.pem',
  JWT_PUBLIC_KEY_PATH: 'public.pem',
};

test('identity configuration uses local email delivery outside production by default', () => {
  const { loadIdentityConfig } = require('../dist/config/config.js');
  assert.equal(loadIdentityConfig(baseEnvironment).emailDeliveryMode, 'local');
});

test('identity configuration requires complete SMTP settings in SMTP mode', () => {
  const { loadIdentityConfig } = require('../dist/config/config.js');
  assert.throws(
    () => loadIdentityConfig({ ...baseEnvironment, EMAIL_DELIVERY_MODE: 'smtp' }),
    /SMTP_HOST/,
  );
});
