const assert = require('node:assert/strict');
const test = require('node:test');

test('payment orchestrator delegates the event within one transaction', async () => {
  const { PaymentOrchestrator } = require('../dist/booking/payment-orchestrator.js');
  const event = {
    eventId: '00000000-0000-0000-0000-000000000001',
    eventType: 'PaymentSucceeded',
    correlationId: 'corr-001',
    payload: {
      paymentId: 'payment-001',
      bookingId: 'booking-001',
      amountVnd: 180000,
    },
  };
  let transactionCalls = 0;
  let repositoryEvent;
  const orchestrator = new PaymentOrchestrator(
    { run: async (work) => { transactionCalls += 1; return work({}); } },
    { processPaymentEvent: async (_client, received) => { repositoryEvent = received; return 'processed'; } },
  );

  assert.equal(await orchestrator.process(event), 'processed');
  assert.equal(transactionCalls, 1);
  assert.deepEqual(repositoryEvent, event);
});
