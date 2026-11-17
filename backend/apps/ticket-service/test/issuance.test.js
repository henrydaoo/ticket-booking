const assert = require('node:assert/strict');
const test = require('node:test');

const encryptionKey = Buffer.alloc(32, 17);
const event = {
  eventId: 'booking-001:BookingConfirmed',
  eventType: 'BookingConfirmed',
  schemaVersion: 1,
  aggregateType: 'Booking',
  aggregateId: 'booking-001',
  occurredAt: '2026-11-16T12:00:00.000Z',
  correlationId: 'correlation-001',
  payload: {
    bookingId: 'booking-001',
    customerId: 'customer-001',
    recipientEmail: 'customer@example.com',
    showtimeId: 'showtime-001',
    showtimeStartAt: '2026-11-17T12:00:00.000Z',
    branchId: 'branch-001',
    seats: [{ seat_id: 'seat-001' }, { seat_id: 'seat-002' }],
  },
};

function serviceWith(repository, checkIns) {
  const config = { qrTokenEncryptionKey: encryptionKey };
  return new (require('../dist/tickets/ticket.service.js').TicketService)(
    { async run(work) { return work({}); } },
    repository,
    config,
    checkIns,
  );
}

test('BookingConfirmed issues one encrypted QR credential per unique seat', async () => {
  const { decryptQrToken } = require('../dist/qr-token-cipher.js');
  let captured;
  const service = serviceWith({
    async issueBookingConfirmed(_client, receivedEvent, tickets) {
      captured = { receivedEvent, tickets };
      return { duplicate: false, tickets: [] };
    },
  });

  await service.processBookingConfirmed(event);

  assert.equal(captured.receivedEvent.eventId, event.eventId);
  assert.equal(captured.tickets.length, 2);
  assert.deepEqual(captured.tickets.map((ticket) => ticket.seatId), ['seat-001', 'seat-002']);
  const tokens = captured.tickets.map((ticket) =>
    decryptQrToken(
      {
        ciphertext: ticket.qrTokenCiphertext,
        nonce: ticket.qrTokenNonce,
        authTag: ticket.qrTokenAuthTag,
      },
      encryptionKey,
    ),
  );
  assert.equal(new Set(tokens).size, 2);
  assert.ok(tokens.every((token) => Buffer.from(token, 'base64url').length === 32));
  assert.ok(captured.tickets.every((ticket) => !ticket.qrTokenCiphertext.includes(tokens[0])));
});

test('malformed BookingConfirmed events do not begin a transaction', async () => {
  let transactionCount = 0;
  const service = new (require('../dist/tickets/ticket.service.js').TicketService)(
    { async run(work) { transactionCount += 1; return work({}); } },
    { async issueBookingConfirmed() { throw new Error('must not issue'); } },
    { qrTokenEncryptionKey: encryptionKey },
  );

  await assert.rejects(
    service.processBookingConfirmed({
      ...event,
      payload: { ...event.payload, seats: [{ seat_id: 'seat-001' }, { seat_id: 'seat-001' }] },
    }),
    /DUPLICATE_BOOKING_CONFIRMED_SEAT/,
  );
  assert.equal(transactionCount, 0);
});

test('BookingConfirmed aggregate must match the booking in its payload', async () => {
  const { parseBookingConfirmedEvent } = require('../dist/tickets/ticket.service.js');
  assert.throws(
    () => parseBookingConfirmedEvent({ ...event, aggregateId: 'other-booking' }),
    /BOOKING_CONFIRMED_AGGREGATE_MISMATCH/,
  );
});

test('duplicate BookingConfirmed delivery is acknowledged without inserting tickets', async () => {
  const { TicketRepository } = require('../dist/tickets/ticket.repository.js');
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      return { rowCount: 0, rows: [] };
    },
  };
  const result = await new TicketRepository().issueBookingConfirmed(client, event, []);

  assert.equal(result.duplicate, true);
  assert.deepEqual(result.tickets, []);
  assert.equal(queries.length, 1);
});

test('existing booking-seat tickets do not emit another TicketIssued event', async () => {
  const { TicketRepository } = require('../dist/tickets/ticket.repository.js');
  const queries = [];
  const client = {
    async query(sql) {
      queries.push(sql);
      if (queries.length === 1) return { rowCount: 1, rows: [{ event_id: event.eventId }] };
      return { rowCount: 0, rows: [] };
    },
  };
  const result = await new TicketRepository().issueBookingConfirmed(
    client,
    { ...event, eventId: 'booking-001:BookingConfirmed-replay' },
    [{
      ticketId: 'ticket-001',
      bookingId: event.payload.bookingId,
      customerId: event.payload.customerId,
      showtimeId: event.payload.showtimeId,
      seatId: event.payload.seats[0].seat_id,
      ticketCode: 'CODE001',
      qrTokenCiphertext: 'ciphertext',
      qrTokenNonce: 'nonce',
      qrTokenAuthTag: 'tag',
    }],
  );

  assert.equal(result.duplicate, false);
  assert.deepEqual(result.tickets, []);
  assert.equal(queries.length, 2);
});

test('TicketIssued outbox event contains no QR credential', async () => {
  const { TicketRepository } = require('../dist/tickets/ticket.repository.js');
  const queries = [];
  const client = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (queries.length === 1) return { rowCount: 1, rows: [] };
      if (queries.length === 2) {
        return {
          rowCount: 1,
          rows: [{
            ticket_id: 'ticket-001',
            booking_id: 'booking-001',
            customer_id: 'customer-001',
            showtime_id: 'showtime-001',
            seat_id: 'seat-001',
            ticket_code: 'CODE001',
          }],
        };
      }
      return { rowCount: 1, rows: [] };
    },
  };

  await new TicketRepository().issueBookingConfirmed(client, event, [{
    ticketId: 'ticket-001',
    bookingId: event.payload.bookingId,
    customerId: event.payload.customerId,
    showtimeId: event.payload.showtimeId,
    seatId: event.payload.seats[0].seat_id,
    ticketCode: 'CODE001',
    qrTokenCiphertext: 'ciphertext',
    qrTokenNonce: 'nonce',
    qrTokenAuthTag: 'tag',
  }]);

  const outboxPayload = JSON.parse(queries[2].values[3]);
  assert.equal(outboxPayload.eventType, 'TicketIssued');
  assert.equal(JSON.stringify(outboxPayload).includes('qrToken'), false);
  assert.equal(JSON.stringify(outboxPayload).includes('ciphertext'), false);
});

test('ticket listing is customer-scoped and only returns QR tokens for valid tickets', async () => {
  const { encryptQrToken } = require('../dist/qr-token-cipher.js');
  const encrypted = encryptQrToken('opaque-qr-token', encryptionKey);
  let customerId;
  const validRow = {
    ticket_id: 'ticket-001',
    booking_id: 'booking-001',
    customer_id: 'customer-001',
    showtime_id: 'showtime-001',
    seat_id: 'seat-001',
    ticket_code: 'CODE001',
    qr_token_ciphertext: encrypted.ciphertext,
    qr_token_nonce: encrypted.nonce,
    qr_token_auth_tag: encrypted.authTag,
    status: 'VALID',
    issued_at: new Date('2026-11-16T12:00:00.000Z'),
  };
  const usedRow = {
    ...validRow,
    ticket_id: 'ticket-002',
    seat_id: 'seat-002',
    status: 'USED',
  };
  const service = serviceWith({
    async listByCustomer(_client, userId) {
      customerId = userId;
      return [validRow, usedRow];
    },
  });

  const tickets = await service.listForCustomer({
    userId: 'customer-001',
    roles: ['CUSTOMER'],
    branchIds: [],
  });

  assert.equal(customerId, 'customer-001');
  assert.equal(tickets[0].qrToken, 'opaque-qr-token');
  assert.equal(tickets[1].qrToken, null);
});

test('non-customers cannot retrieve the customer ticket list', async () => {
  const service = serviceWith({
    async listByCustomer() { throw new Error('must not query'); },
  });

  await assert.rejects(
    service.listForCustomer({ userId: 'staff-001', roles: ['CINEMA_STAFF'], branchIds: [] }),
    /CUSTOMER_ROLE_REQUIRED/,
  );
});

test('authorized staff check-in transitions a valid ticket and preserves branch context', async () => {
  const calls = [];
  const service = serviceWith(
    {},
    {
      async findTicketForUpdate(_client, digest) {
        calls.push(['find', digest]);
        return {
          ticket_id: 'ticket-001',
          booking_id: 'booking-001',
          showtime_id: 'showtime-001',
          branch_id: 'branch-001',
          status: 'VALID',
        };
      },
      async createCheckIn(_client, ticket, input) {
        calls.push(['create', ticket.ticket_id, input]);
        return {
          checkInId: 'checkin-001',
          ticketId: ticket.ticket_id,
          bookingId: ticket.booking_id,
          showtimeId: input.showtimeId,
          branchId: input.branchId,
          status: 'USED',
          checkedInAt: '2026-11-17T00:00:00.000Z',
        };
      },
    },
  );

  const result = await service.checkIn(
    {
      qrToken: 'opaque-qr-token',
      showtimeId: 'showtime-001',
      branchId: 'branch-001',
      correlationId: 'correlation-001',
    },
    {
      userId: 'staff-001',
      roles: ['CINEMA_STAFF'],
      branchIds: ['branch-001'],
      mfaCompleted: false,
    },
  );

  assert.equal(result.status, 'USED');
  assert.equal(calls[1][2].actorId, 'staff-001');
  assert.equal(calls[1][2].branchId, 'branch-001');
});

test('check-in rejects a ticket from another branch', async () => {
  const service = serviceWith(
    {},
    {
      async findTicketForUpdate() {
        return {
          ticket_id: 'ticket-001',
          booking_id: 'booking-001',
          showtime_id: 'showtime-001',
          branch_id: 'branch-002',
          status: 'VALID',
        };
      },
    },
  );

  await assert.rejects(
    service.checkIn(
      {
        qrToken: 'opaque-qr-token',
        showtimeId: 'showtime-001',
        branchId: 'branch-001',
        correlationId: 'correlation-001',
      },
      {
        userId: 'staff-001',
        roles: ['CINEMA_STAFF'],
        branchIds: ['branch-001'],
        mfaCompleted: false,
      },
    ),
    /TICKET_BRANCH_FORBIDDEN/,
  );
});

test('only managers and MFA-complete platform admins can reverse a check-in', async () => {
  let reversed = false;
  const service = serviceWith(
    {},
    {
      async findCheckInForUpdate() {
        return {
          checkInId: 'checkin-001',
          ticketId: 'ticket-001',
          bookingId: 'booking-001',
          branchId: 'branch-001',
          status: 'USED',
        };
      },
      async reverseCheckIn(_client, checkIn, actorId, reason) {
        reversed = true;
        return {
          checkInId: checkIn.checkInId,
          ticketId: checkIn.ticketId,
          status: 'VALID',
          reversedAt: '2026-11-17T00:00:00.000Z',
          actorId,
          reason,
        };
      },
    },
  );

  await assert.rejects(
    service.reverseCheckIn(
      'checkin-001',
      'operator correction',
      'branch-001',
      'correlation-001',
      {
        userId: 'staff-001',
        roles: ['CINEMA_STAFF'],
        branchIds: ['branch-001'],
        mfaCompleted: false,
      },
    ),
    /CHECK_IN_REVERSAL_ROLE_REQUIRED/,
  );

  await assert.rejects(
    service.reverseCheckIn(
      'checkin-001',
      'operator correction',
      'branch-001',
      'correlation-001',
      {
        userId: 'admin-001',
        roles: ['PLATFORM_ADMIN'],
        branchIds: ['branch-001'],
        mfaCompleted: false,
      },
    ),
    /PLATFORM_ADMIN_MFA_REQUIRED/,
  );

  const result = await service.reverseCheckIn(
    'checkin-001',
    'operator correction',
    'branch-001',
    'correlation-001',
    {
      userId: 'manager-001',
      roles: ['CINEMA_MANAGER'],
      branchIds: ['branch-001'],
      mfaCompleted: false,
    },
  );
  assert.equal(result.status, 'VALID');
  assert.equal(reversed, true);
});
