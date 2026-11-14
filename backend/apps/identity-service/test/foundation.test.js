const assert = require('node:assert/strict');
const test = require('node:test');
const { PasswordService } = require('../dist/modules/auth/password.service.js');

test('password service hashes and verifies passwords without storing plaintext', async () => {
  const service = new PasswordService();
  const hash = await service.hash('correct horse battery staple');

  assert.notEqual(hash, 'correct horse battery staple');
  assert.equal(await service.verify('correct horse battery staple', hash), true);
  assert.equal(await service.verify('wrong password', hash), false);
});
