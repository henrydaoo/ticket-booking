export type TicketStatus = 'VALID' | 'USED' | 'CANCELLED';

export type TicketResponse = {
  ticketId: string;
  bookingId: string;
  showtimeId: string;
  seatId: string;
  ticketCode: string;
  status: TicketStatus;
  issuedAt: string;
  qrToken: string | null;
};

export type BookingConfirmedEvent = {
  eventId: string;
  eventType: 'BookingConfirmed';
  schemaVersion: 1;
  aggregateType: 'Booking';
  aggregateId: string;
  occurredAt: string;
  correlationId: string;
  payload: {
    bookingId: string;
    customerId: string;
    recipientEmail: string;
    showtimeId: string;
    showtimeStartAt: string;
    branchId: string;
    seats: Array<{ seat_id: string }>;
  };
};

export type NewTicket = {
  ticketId: string;
  bookingId: string;
  customerId: string;
  showtimeId: string;
  branchId: string;
  seatId: string;
  ticketCode: string;
  qrTokenCiphertext: string;
  qrTokenNonce: string;
  qrTokenAuthTag: string;
  qrTokenDigest: string;
};

export type TicketRow = {
  ticket_id: string;
  booking_id: string;
  customer_id: string;
  showtime_id: string;
  branch_id: string | null;
  seat_id: string;
  ticket_code: string;
  qr_token_ciphertext: string;
  qr_token_nonce: string;
  qr_token_auth_tag: string;
  status: TicketStatus;
  issued_at: Date;
};

export type CheckInResponse = {
  checkInId: string;
  ticketId: string;
  bookingId: string;
  showtimeId: string;
  branchId: string;
  status: 'USED';
  checkedInAt: string;
};

export type ReverseCheckInResponse = {
  checkInId: string;
  ticketId: string;
  status: 'VALID';
  reversedAt: string;
};
