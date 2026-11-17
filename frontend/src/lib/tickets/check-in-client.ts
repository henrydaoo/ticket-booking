import { apiRequest } from '@/lib/api-client/client';

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

export function checkInTicket(input: {
  qrToken: string;
  showtimeId: string;
  branchId: string;
}): Promise<CheckInResponse> {
  return apiRequest<CheckInResponse>('/ticket/check-ins', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function reverseCheckIn(
  checkInId: string,
  input: { reason: string; branchId: string },
): Promise<ReverseCheckInResponse> {
  return apiRequest<ReverseCheckInResponse>(
    `/ticket/check-ins/${encodeURIComponent(checkInId)}/reverse`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}
