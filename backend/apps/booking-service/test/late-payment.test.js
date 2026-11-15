const assert = require('node:assert/strict');
const test = require('node:test');

test('payment orchestrator remains transaction-scoped for late-success compensation', async () => {
  const { PaymentOrchestrator } = require('../dist/booking/payment-orchestrator.js');
  let received;
  let transactionCount = 0;
  const orchestrator = new PaymentOrchestrator(
    {
      run: async (work) => {
        transactionCount += 1;
        return work({});
      },
    },
    {
      processPaymentEvent: async (_client, event) => {
        received = event;
        return 'processed';
      },
    },
  );
  const result = await orchestrator.process({
    eventId: 'payment-001',
    eventType: 'PaymentSucceeded',
    correlationId: 'corr-001',
    payload: {
      paymentId: 'payment-001',
      bookingId: 'booking-001',
      amountVnd: 180000,
    },
  });
  assert.equal(result, 'processed');
  assert.equal(transactionCount, 1);
  assert.equal(received.payload.paymentId, 'payment-001');
});
