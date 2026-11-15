import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelReservation,
  createBooking,
  createPayment,
  createReservation,
  getPayment,
  getSeatMap,
  listBookings,
} from './booking-client';

export const bookingQueryKeys = {
  seatMap: (showtimeId: string) => ['booking', 'seat-map', showtimeId] as const,
  bookings: ['booking', 'bookings'] as const,
  payment: (paymentId: string) => ['payment', paymentId] as const,
};

export function useSeatMapQuery(showtimeId: string) {
  return useQuery({
    queryKey: bookingQueryKeys.seatMap(showtimeId),
    queryFn: () => getSeatMap(showtimeId),
    enabled: Boolean(showtimeId),
  });
}

export function useReservationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReservation,
    onSuccess: (reservation) => {
      void queryClient.invalidateQueries({
        queryKey: bookingQueryKeys.seatMap(reservation.showtimeId),
      });
    },
  });
}

export function useCancelReservationMutation() {
  return useMutation({ mutationFn: cancelReservation });
}

export function useBookingMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBooking,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bookingQueryKeys.bookings });
    },
  });
}

export function usePaymentMutation() {
  return useMutation({ mutationFn: createPayment });
}

export function useBookingsQuery() {
  return useQuery({
    queryKey: bookingQueryKeys.bookings,
    queryFn: listBookings,
  });
}

export function usePaymentQuery(paymentId: string) {
  return useQuery({
    queryKey: bookingQueryKeys.payment(paymentId),
    queryFn: () => getPayment(paymentId),
    enabled: Boolean(paymentId),
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING' || query.state.data?.status === 'PROCESSING'
        ? 3000
        : false,
  });
}
