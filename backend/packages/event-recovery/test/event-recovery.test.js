const assert = require('node:assert/strict');
const test = require('node:test');
const { createDeadLetterEnvelope, deadLetterTopic } = require('../dist/index.js');

test('DLQ topic and envelope preserve replay metadata', () => {
  assert.equal(deadLetterTopic('booking.booking-confirmed.v1'), 'booking.booking-confirmed.v1.dlq.v1');
  const envelope = createDeadLetterEnvelope({
    sourceTopic: 'booking.booking-confirmed.v1',
    sourcePartition: 2,
    sourceOffset: '17',
    service: 'ticket-service',
    error: new Error('consumer failed'),
    payload: { eventId: 'event-1', correlationId: 'corr-1', payload: { bookingId: 'booking-1' } },
  });
  assert.equal(envelope.contract, 'ticket-booking.kafka-dlq');
  assert.equal(envelope.eventId, 'event-1');
  assert.equal(envelope.correlationId, 'corr-1');
  assert.deepEqual(envelope.payload, {
    eventId: 'event-1',
    correlationId: 'corr-1',
    payload: { bookingId: 'booking-1' },
  });
});
