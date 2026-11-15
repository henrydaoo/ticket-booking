const assert = require('node:assert/strict');
const test = require('node:test');

test('VNPay provider uses the booking amount in VND and a stable transaction reference', async () => {
  const { VnpayProvider } = require('../dist/provider/vnpay.provider.js');
  const provider = new VnpayProvider({
    vnpayPaymentUrl: 'https://sandbox.example/pay',
    vnpayTmnCode: 'tmn-code',
    vnpayHashSecret: 'test-secret',
  });

  const result = await provider.createPayment({
    paymentId: 'payment-001',
    amountVnd: 180000,
    orderInfo: 'Cinema booking booking-001',
    returnUrl: 'https://frontend.example/payment/return',
    ipnUrl: 'https://api.example/payment/webhooks/vnpay',
    clientIp: '127.0.0.1',
    createdAt: new Date('2030-01-15T05:00:00.000Z'),
  });

  const url = new URL(result.paymentUrl);
  assert.equal(result.providerReference, 'payment-001');
  assert.equal(url.searchParams.get('vnp_Amount'), '18000000');
  assert.equal(url.searchParams.get('vnp_TxnRef'), 'payment-001');
  assert.equal(url.searchParams.get('vnp_SecureHashType'), 'HmacSHA512');
  assert.ok(url.searchParams.get('vnp_SecureHash'));
});

test('payment service uses the booking snapshot and does not invoke provider twice for an idempotent retry', async () => {
  const { PaymentService } = require('../dist/payment.service.js');
  const calls = [];
  const existing = {
    paymentId: 'payment-001',
    bookingId: 'booking-001',
    status: 'PENDING',
    amountVnd: 180000,
    provider: 'VNPAY',
    paymentUrl: 'https://sandbox.example/pay?txn=payment-001',
    processingDeadlineAt: '2030-01-15T05:05:00.000Z',
  };
  let lookupCount = 0;
  const service = new PaymentService(
    {
      run: async (work) =>
        work({
          query: async () => {
            throw new Error('transaction query should be handled by repository mock');
          },
        }),
    },
    {
      findByIdempotencyKey: async () => {
        lookupCount += 1;
        return lookupCount <= 2 ? null : existing;
      },
      createPending: async (_client, input) => calls.push(['create', input]),
      completeProviderCreation: async () => existing,
    },
    {
      getPaymentContext: async () => ({
        bookingId: 'booking-001',
        customerId: 'customer-001',
        status: 'PENDING_PAYMENT',
        totalVnd: 180000,
        paymentDeadlineAt: '2030-01-15T05:05:00.000Z',
      }),
    },
    {
      createPayment: async (input) => {
        calls.push(['provider', input]);
        return {
          providerReference: input.paymentId,
          paymentUrl: 'https://sandbox.example/pay?txn=' + input.paymentId,
        };
      },
    },
    { paymentProcessingDeadlineSeconds: 300 },
  );

  const input = { bookingId: 'booking-001', idempotencyKey: 'payment-key-001' };
  const first = await service.create(
    { userId: 'customer-001' },
    input,
    'corr-001',
    '127.0.0.1',
  );
  const second = await service.create(
    { userId: 'customer-001' },
    input,
    'corr-001',
    '127.0.0.1',
  );

  assert.equal(first.amountVnd, 180000);
  assert.deepEqual(second, existing);
  assert.equal(calls.filter(([kind]) => kind === 'provider').length, 1);
  assert.equal(calls[0][1].amountVnd, 180000);
});
