import { apiRequest } from '@/lib/api-client/client';

export type TicketStatus = 'VALID' | 'USED' | 'CANCELLED';

export type Ticket = {
  ticketId: string;
  bookingId: string;
  showtimeId: string;
  seatId: string;
  ticketCode: string;
  status: TicketStatus;
  issuedAt: string;
  qrToken: string | null;
};

export function listTickets(): Promise<Ticket[]> {
  return apiRequest<Ticket[]>('/ticket/tickets');
}
