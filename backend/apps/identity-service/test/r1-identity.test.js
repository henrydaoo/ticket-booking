const assert = require('node:assert/strict');
const test = require('node:test');
const {
  LocalEmailDeliveryAdapter,
} = require('../dist/infrastructure/email/local-email-delivery.adapter.js');
const { TotpService } = require('../dist/modules/auth/totp.service.js');

test('TOTP codes verify within the current time step and reject malformed codes', () => {
  const service = new TotpService();
  const secret = 'JBSWY3DPEHPK3PXP';
  const at = Date.UTC(2030, 0, 1, 0, 0, 0);
  const code = service.generateCode(secret, at);

  assert.match(code, /^\d{6}$/);
  assert.equal(service.verifyCode(secret, code, at), true);
  assert.equal(service.verifyCode(secret, 'invalid', at), false);
  assert.equal(service.verifyCode(secret, code, at + 120_000), false);
});

test('local email adapter stores provider-neutral messages for test inspection', async () => {
  const adapter = new LocalEmailDeliveryAdapter();
  const message = {
    messageId: 'message-r1-001',
    recipient: 'customer.r1@example.test',
    verificationLink: 'http://localhost:3000/verify-email?token=test-token',
    expiresAt: '2030-01-01T01:00:00Z',
  };

  const result = await adapter.sendVerificationEmail(message);

  assert.deepEqual(result, { messageId: message.messageId });
  assert.deepEqual(adapter.getMessage(message.messageId), message);
});
