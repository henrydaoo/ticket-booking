import { useMutation } from '@tanstack/react-query';
import { checkInTicket, reverseCheckIn } from './check-in-client';

export function useCheckInMutation() {
  return useMutation({ mutationFn: checkInTicket });
}

export function useReverseCheckInMutation() {
  return useMutation({
    mutationFn: ({
      checkInId,
      reason,
      branchId,
    }: {
      checkInId: string;
      reason: string;
      branchId: string;
    }) => reverseCheckIn(checkInId, { reason, branchId }),
  });
}
