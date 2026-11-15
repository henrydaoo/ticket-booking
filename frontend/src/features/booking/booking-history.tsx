'use client';

import { AsyncState } from '@/components/ui/async-state';
import { Badge } from '@/components/ui/badge';
import { useBookingsQuery } from '@/lib/booking/booking-queries';
import { ApiError } from '@/lib/api-client/client';

function formatVnd(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} VND`;
}

export function BookingHistory() {
  const query = useBookingsQuery();
  const error = query.error instanceof ApiError && query.error.status === 401
    ? 'Please sign in again to view your bookings.'
    : query.error
      ? 'Booking history is unavailable. Please try again.'
      : '';
  return (
    <section className="space-y-4">
      <div><p className="text-sm font-medium text-zinc-500">BOOKINGS</p><h2 className="text-2xl font-semibold text-white">Booking history</h2></div>
      <AsyncState loading={query.isPending} error={error} empty={!query.isPending && !query.error && query.data?.length === 0}>
        <div className="space-y-3">{query.data?.map((booking) => (
          <article key={booking.bookingId} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-white">{booking.bookingId}</p><Badge>{booking.status}</Badge></div>
            <p className="mt-2 text-sm text-zinc-400">{booking.seats.length} seat(s) · {formatVnd(booking.totalVnd)}</p>
          </article>
        ))}</div>
      </AsyncState>
      {query.error && <button className="text-sm text-zinc-300 underline" onClick={() => void query.refetch()}>Retry</button>}
    </section>
  );
}
