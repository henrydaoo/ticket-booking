const assert = require('node:assert/strict');
const test = require('node:test');

test('webhook processing rejects invalid signatures before opening a transaction', async () => {
  const { PaymentService } = require('../dist/payment.service.js');
  let transactionCalls = 0;
  const service = new PaymentService(
    { run: async () => { transactionCalls += 1; } },
    {},
    {},
    { verifyCallback: () => { throw new Error('INVALID_WEBHOOK_SIGNATURE'); } },
    { paymentProcessingDeadlineSeconds: 300 },
  );

  await assert.rejects(
    service.processWebhook({ vnp_SecureHash: 'invalid' }, 'corr-001'),
    (error) => error.status === 400 && error.message === 'INVALID_WEBHOOK_SIGNATURE',
  );
  assert.equal(transactionCalls, 0);
});

test('duplicate webhook receipt is acknowledged without a second business effect', async () => {
  const { PaymentService } = require('../dist/payment.service.js');
  let repositoryCalls = 0;
  const service = new PaymentService(
    {
      run: async (work) => work({}),
    },
    {
      processWebhook: async (_client, input) => {
        repositoryCalls += 1;
        assert.equal(input.provider, 'VNPAY');
        return repositoryCalls === 1 ? 'processed' : 'duplicate';
      },
    },
    {},
    {
      verifyCallback: () => ({
        providerReference: 'payment-001',
        paymentId: 'payment-001',
        amountVnd: 180000,
        success: true,
        responseCode: '00',
      }),
    },
    { paymentProcessingDeadlineSeconds: 300 },
  );
  const parameters = {
    vnp_TxnRef: 'payment-001',
    vnp_TransactionNo: 'provider-001',
    vnp_ResponseCode: '00',
    vnp_SecureHash: 'signature',
  };

  assert.deepEqual(await service.processWebhook(parameters, 'corr-001'), {
    received: true,
    duplicate: false,
  });
  assert.deepEqual(await service.processWebhook(parameters, 'corr-001'), {
    received: true,
    duplicate: true,
  });
});
