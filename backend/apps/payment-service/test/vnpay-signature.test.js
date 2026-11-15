const assert = require('node:assert/strict');
const test = require('node:test');

test('VNPay callback signature is deterministic and excludes signature fields', () => {
  const { hasValidVnpaySignature, vnpaySignature } = require('../dist/provider/vnpay-signature.js');
  const parameters = {
    vnp_Amount: '10000000',
    vnp_ResponseCode: '00',
    vnp_TxnRef: 'payment-001',
    vnp_SecureHashType: 'HmacSHA512',
  };
  const signature = vnpaySignature(parameters, 'test-secret');

  assert.equal(hasValidVnpaySignature({ ...parameters, vnp_SecureHash: signature }, signature, 'test-secret'), true);
  assert.equal(hasValidVnpaySignature({ ...parameters, vnp_SecureHash: signature }, `${signature}0`, 'test-secret'), false);
});
