const assert = require('node:assert/strict');
const test = require('node:test');

test('VNPay transaction operations map provider query and refund responses', async () => {
  const { VnpayProvider } = require('../dist/provider/vnpay.provider.js');
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (_url, options) => {
    requests.push(options.body.toString());
    return {
      ok: true,
      text: async () => 'vnp_ResponseCode=00&vnp_TransactionStatus=00',
    };
  };
  try {
    const provider = new VnpayProvider({
      vnpayPaymentUrl: 'https://sandbox.example/pay',
      vnpayApiUrl: 'https://sandbox.example/api',
      vnpayTmnCode: 'tmn-code',
      vnpayHashSecret: 'test-secret',
    });
    const query = await provider.queryPayment({
      paymentId: 'payment-001',
      providerReference: 'payment-001',
      amountVnd: 180000,
      transactionDate: new Date('2030-01-15T05:00:00.000Z'),
    });
    const refund = await provider.createRefund({
      paymentId: 'payment-001',
      providerReference: 'payment-001',
      amountVnd: 180000,
      idempotencyKey: 'refund:payment-001:late-success',
      orderInfo: 'Refund booking booking-001',
      transactionDate: new Date('2030-01-15T05:00:00.000Z'),
      clientIp: '127.0.0.1',
    });
    assert.equal(query.status, 'SUCCEEDED');
    assert.equal(refund.status, 'SUCCEEDED');
    assert.equal(requests.length, 2);
    assert.match(requests[0], /vnp_Command=querydr/);
    assert.match(requests[1], /vnp_Command=refund/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('refund service creates one business refund operation for duplicate events', async () => {
  const { RefundService } = require('../dist/refund.service.js');
  let providerCalls = 0;
  let createCalls = 0;
  const service = new RefundService(
    {
      connect: async () => ({
        query: async (sql) => {
          if (sql.includes('SELECT provider_reference')) {
            return { rowCount: 1, rows: [{ provider_reference: 'payment-001', status: 'SUCCEEDED' }] };
          }
          return { rowCount: 0, rows: [] };
        },
        release: () => {},
      }),
    },
    {
      createOrGet: async () => {
        createCalls += 1;
        return { id: 'refund-001', status: 'SUCCEEDED', providerReference: 'refund-001' };
      },
      updateResult: async () => {},
      updatePaymentState: async () => {},
    },
    {
      createRefund: async () => {
        providerCalls += 1;
        return { status: 'SUCCEEDED', providerReference: 'refund-001', responseCode: '00' };
      },
    },
    {},
  );
  const event = {
    eventId: 'booking-001:RefundRequested',
    payload: {
      bookingId: 'booking-001',
      paymentId: 'payment-001',
      amountVnd: 180000,
      reasonCode: 'PAYMENT_SUCCEEDED_AFTER_SEAT_RELEASE',
    },
  };
  await service.process(event);
  await service.process(event);
  assert.equal(createCalls, 2);
  assert.equal(providerCalls, 0);
});
