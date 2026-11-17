import { useQuery } from '@tanstack/react-query';
import { readSession } from '@/lib/auth/auth-boundary';
import { listTickets } from './ticket-client';

export const ticketQueryKeys = {
  list: (customerId: string | undefined) => ['tickets', 'list', customerId] as const,
};

export function useTicketsQuery() {
  const customerId = readSession()?.user.id;
  return useQuery({
    queryKey: ticketQueryKeys.list(customerId),
    queryFn: listTickets,
    enabled: Boolean(customerId),
  });
}
