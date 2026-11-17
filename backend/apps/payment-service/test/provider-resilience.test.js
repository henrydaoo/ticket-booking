const assert = require('node:assert/strict');
const test = require('node:test');

test('payment provider circuit opens after bounded retry failures and recovers with a half-open probe', async () => {
  const { ResilientPaymentProvider } = require('../dist/provider/resilient-payment.provider.js');
  let calls = 0;
  const delegate = {
    createPayment: async () => {
      calls += 1;
      throw new Error('PROVIDER_UNAVAILABLE');
    },
    verifyCallback: () => {
      throw new Error('unused');
    },
    queryPayment: async () => {
      throw new Error('unused');
    },
    createRefund: async () => {
      throw new Error('unused');
    },
  };
  const provider = new ResilientPaymentProvider(delegate);

  await assert.rejects(() => provider.createPayment({}), /PROVIDER_UNAVAILABLE/);
  await assert.rejects(() => provider.createPayment({}), /PROVIDER_UNAVAILABLE/);
  await assert.rejects(() => provider.createPayment({}), /PROVIDER_UNAVAILABLE/);
  await assert.rejects(() => provider.createPayment({}), /PAYMENT_PROVIDER_CIRCUIT_OPEN/);
  assert.equal(calls, 6);

  provider.openedAt = Date.now() - 31_000;
  provider.delegate.createPayment = async () => ({ paymentUrl: 'https://pay', providerReference: 'ref' });
  const result = await provider.createPayment({});
  assert.equal(result.providerReference, 'ref');
});
