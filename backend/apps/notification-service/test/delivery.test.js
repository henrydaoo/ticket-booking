const assert = require('node:assert/strict');
const test = require('node:test');

const { buildNotificationJobs, parseNotificationEvent } = require('../dist/notification.parser.js');
const { NotificationDeliveryWorker } = require('../dist/delivery.worker.js');

function ticketIssuedEvent(showtimeStartAt) {
  return {
    eventId: 'ticket-001:TicketIssued',
    eventType: 'TicketIssued',
    schemaVersion: 1,
    aggregateType: 'Booking',
    aggregateId: 'booking-001',
    occurredAt: '2026-11-16T12:00:00.000Z',
    correlationId: 'correlation-001',
    payload: {
      bookingId: 'booking-001',
      recipientEmail: 'customer@example.com',
      showtimeStartAt,
      tickets: [{ ticketId: 'ticket-001', seatId: 'seat-001', ticketCode: 'CODE001' }],
    },
  };
}

test('TicketIssued creates one immediate notification and one 24-hour reminder', () => {
  const event = parseNotificationEvent(ticketIssuedEvent('2026-11-20T12:00:00.000Z'));
  const jobs = buildNotificationJobs(event);

  assert.deepEqual(jobs.map((job) => job.type), ['TICKET_ISSUED', 'SHOWTIME_REMINDER']);
  assert.equal(jobs[1].scheduledAt.toISOString(), '2026-11-19T12:00:00.000Z');
  assert.equal(jobs[0].recipientEmail, 'customer@example.com');
});

test('late TicketIssued events do not create a late reminder', () => {
  const event = parseNotificationEvent(ticketIssuedEvent('2026-11-16T12:00:00.000Z'));
  const jobs = buildNotificationJobs(event);
  assert.deepEqual(jobs.map((job) => job.type), ['TICKET_ISSUED']);
});

test('retryable provider failures are recorded for exhausted jobs', async () => {
  let markFailedInput;
  const repository = {
    async claimNext() {
      return {
        id: 'job-001',
        type: 'TICKET_ISSUED',
        recipientEmail: 'customer@example.com',
        templateData: {},
        correlationId: 'correlation-001',
        attemptCount: 5,
      };
    },
    async markFailed(job, message, retryable) {
      markFailedInput = { job, message, retryable };
    },
  };
  const worker = new NotificationDeliveryWorker(repository, {
    async send() {
      const error = new Error('provider unavailable');
      error.retryable = true;
      throw error;
    },
  });

  await worker.processOnce();
  assert.equal(markFailedInput.job.id, 'job-001');
  assert.equal(markFailedInput.retryable, true);
});

test('duplicate event delivery is represented by a stable event and type key', () => {
  const event = parseNotificationEvent({
    ...ticketIssuedEvent('2026-11-20T12:00:00.000Z'),
    eventId: 'same-event',
  });
  const jobs = buildNotificationJobs(event);
  assert.deepEqual(
    jobs.map((job) => `${event.eventId}:${job.type}`),
    ['same-event:TICKET_ISSUED', 'same-event:SHOWTIME_REMINDER'],
  );
});
