'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError } from '@/lib/api-client/client';
import { useBookingMutation, useCancelReservationMutation, usePaymentMutation, useReservationMutation, useSeatMapQuery } from '@/lib/booking/booking-queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AsyncState } from '@/components/ui/async-state';
import { Badge } from '@/components/ui/badge';

const selectionSchema = z.object({
  seats: z.array(z.string()).min(1, 'Select at least one available seat.'),
});
type SelectionValues = z.infer<typeof selectionSchema>;

function messageFor(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'RESERVATION_EXPIRED' || error.code === 'PAYMENT_DEADLINE_EXPIRED') {
      return 'This booking window has expired. Please select seats again.';
    }
    if (error.status === 409) return 'Some selected seats are no longer available. Please refresh and try again.';
    return error.message;
  }
  return fallback;
}

function formatVnd(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} VND`;
}

export function BookingFlow({ showtimeId }: { showtimeId: string }) {
  const { data, isPending, error, refetch } = useSeatMapQuery(showtimeId);
  const reservationMutation = useReservationMutation();
  const bookingMutation = useBookingMutation();
  const paymentMutation = usePaymentMutation();
  const cancelMutation = useCancelReservationMutation();
  const [reservation, setReservation] = useState<Awaited<ReturnType<typeof reservationMutation.mutateAsync>>>();
  const [booking, setBooking] = useState<Awaited<ReturnType<typeof bookingMutation.mutateAsync>>>();
  const [payment, setPayment] = useState<Awaited<ReturnType<typeof paymentMutation.mutateAsync>>>();
  const form = useForm<SelectionValues>({
    resolver: zodResolver(selectionSchema),
    defaultValues: { seats: [] },
  });
  const selectedIds = form.watch('seats');
  const selectedTotal = useMemo(
    () => data?.seats.filter((seat) => selectedIds.includes(seat.seatId)).reduce((sum, seat) => sum + seat.priceVnd, 0) ?? 0,
    [data?.seats, selectedIds],
  );

  if (reservation && !booking) {
    return (
      <ReservationSummary
        reservation={reservation}
        onCancel={async () => {
          await cancelMutation.mutateAsync(reservation.reservationId);
          setReservation(undefined);
          reservationMutation.reset();
        }}
        onBooking={async () => {
          const created = await bookingMutation.mutateAsync({
            reservationId: reservation.reservationId,
            idempotencyKey: `booking-${reservation.reservationId}`,
          });
          setBooking(created);
        }}
        bookingPending={bookingMutation.isPending}
        error={bookingMutation.error || cancelMutation.error}
      />
    );
  }

  if (booking && !payment) {
    return (
      <BookingSummary
        booking={booking}
        onPay={async () => {
          const created = await paymentMutation.mutateAsync({
            bookingId: booking.bookingId,
            idempotencyKey: `payment-${booking.bookingId}`,
          });
          setPayment(created);
          window.location.assign(created.paymentUrl);
        }}
        pending={paymentMutation.isPending}
        error={paymentMutation.error}
      />
    );
  }

  if (payment) {
    return (
      <Card><CardHeader><h2 className="text-xl font-semibold text-white">Redirecting to payment</h2></CardHeader>
        <CardContent className="space-y-4 text-zinc-300"><p>Your payment request is ready.</p><Link className="underline" href={`/payment/return?paymentId=${encodeURIComponent(payment.paymentId)}`}>Open payment status</Link></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><h1 className="text-2xl font-semibold text-white">Choose your seats</h1><p className="text-zinc-400">The backend decides availability and reservation validity.</p></CardHeader>
      <CardContent>
        <AsyncState loading={isPending} error={error ? messageFor(error, 'Seat map is unavailable.') : ''} empty={!isPending && !error && !data?.inventoryReady}>
          {data && (
            <form className="space-y-6" onSubmit={form.handleSubmit(async (values) => {
              const created = await reservationMutation.mutateAsync({
                showtimeId,
                seatIds: values.seats,
                idempotencyKey: `reservation-${showtimeId}-${values.seats.slice().sort().join('-')}`,
              });
              setReservation(created);
            })}>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                {data.seats.map((seat) => {
                  const selected = selectedIds.includes(seat.seatId);
                  const unavailable = seat.status !== 'AVAILABLE';
                  return <button key={seat.seatId} type="button" disabled={unavailable} onClick={() => form.setValue('seats', selected ? selectedIds.filter((id) => id !== seat.seatId) : [...selectedIds, seat.seatId], { shouldValidate: true })} className={`rounded-lg border p-3 text-center text-sm ${selected ? 'border-amber-400 bg-amber-950 text-amber-200' : unavailable ? 'border-zinc-800 bg-zinc-900 text-zinc-600' : 'border-zinc-700 bg-zinc-950 text-zinc-200 hover:border-zinc-400'}`} aria-label={`${seat.label} ${seat.status}`}>{seat.label}<span className="block text-xs">{formatVnd(seat.priceVnd)}</span></button>;
                })}
              </div>
              <p className="text-sm text-zinc-400">Selected total: {formatVnd(selectedTotal)}</p>
              {form.formState.errors.seats && <p role="alert" className="text-sm text-red-300">{form.formState.errors.seats.message}</p>}
              {reservationMutation.error && <p role="alert" className="text-sm text-red-300">{messageFor(reservationMutation.error, 'Reservation failed.')}</p>}
              <div className="flex gap-3"><Button type="submit" disabled={reservationMutation.isPending}>{reservationMutation.isPending ? 'Reserving...' : 'Reserve seats'}</Button><Button type="button" variant="secondary" onClick={() => void refetch()}>Refresh seats</Button></div>
            </form>
          )}
        </AsyncState>
      </CardContent>
    </Card>
  );
}

function ReservationSummary({ reservation, onCancel, onBooking, bookingPending, error }: { reservation: NonNullable<ReturnType<typeof useReservationMutation>['data']>; onCancel: () => void; onBooking: () => Promise<void>; bookingPending: boolean; error: unknown }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const remaining = Math.max(0, new Date(reservation.expiresAt).getTime() - now);
  const expired = remaining === 0;
  return <Card><CardHeader><h2 className="text-xl font-semibold text-white">Reservation ready</h2><Badge variant={expired ? 'muted' : 'success'}>{expired ? 'Expired' : `Expires in ${Math.ceil(remaining / 1000)}s`}</Badge></CardHeader><CardContent className="space-y-4 text-zinc-300"><p>Total: {formatVnd(reservation.totalVnd)}</p>{error ? <p role="alert" className="text-red-300">{messageFor(error, 'Booking could not be created.')}</p> : null}<div className="flex gap-3"><Button disabled={expired || bookingPending} onClick={() => void onBooking()}>{bookingPending ? 'Creating booking...' : 'Continue to booking'}</Button><Button variant="secondary" onClick={() => void onCancel()}>Cancel reservation</Button></div></CardContent></Card>;
}

function BookingSummary({ booking, onPay, pending, error }: { booking: NonNullable<ReturnType<typeof useBookingMutation>['data']>; onPay: () => Promise<void>; pending: boolean; error: unknown }) {
  return <Card><CardHeader><h2 className="text-xl font-semibold text-white">Booking summary</h2><Badge>{booking.status}</Badge></CardHeader><CardContent className="space-y-4 text-zinc-300"><ul>{booking.seats.map((seat) => <li key={seat.seatId}>{seat.seatId}: {formatVnd(seat.priceVnd)}</li>)}</ul><p className="font-semibold text-white">Total: {formatVnd(booking.totalVnd)}</p>{error ? <p role="alert" className="text-red-300">{messageFor(error, 'Payment could not be started.')}</p> : null}<Button onClick={() => void onPay()} disabled={pending}>{pending ? 'Starting payment...' : 'Pay with VNPay'}</Button></CardContent></Card>;
}
