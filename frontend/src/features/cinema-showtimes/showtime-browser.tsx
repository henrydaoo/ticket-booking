'use client';

import { useShowtimesQuery } from '@/lib/catalog/catalog-queries';
import { AsyncState } from '@/components/ui/async-state';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export function ShowtimeBrowser() {
  const { data: showtimes = [], isPending, error } = useShowtimesQuery();
  const visibleShowtimes = showtimes.filter((showtime) => showtime.discoveryVisible);

  return (
    <section className="space-y-6">
      <div><p className="text-sm font-medium text-zinc-500">SCHEDULE</p><h2 className="text-3xl font-semibold text-white">Choose a showtime</h2></div>
      <AsyncState loading={isPending} error={error ? 'Showtimes are unavailable.' : ''} empty={!isPending && !error && visibleShowtimes.length === 0}>
        <div className="grid gap-4 sm:grid-cols-2">{visibleShowtimes.map((showtime) => (
          <Card key={showtime.id}><CardContent className="space-y-3 p-5"><div className="flex items-center justify-between"><time className="font-medium text-white" dateTime={showtime.startAt}>{new Date(showtime.startAt).toLocaleString()}</time><Badge variant={showtime.bookingEligible ? 'success' : 'muted'}>{showtime.bookingEligible ? 'Open for booking' : 'Not available'}</Badge></div><div className="space-y-1 text-sm text-zinc-400"><p>Sale opens: {showtime.saleOpensAt ? new Date(showtime.saleOpensAt).toLocaleString() : 'At publication'}</p><p>Reservation cutoff: {new Date(showtime.reservationCutoffAt).toLocaleString()}</p></div>{showtime.bookingEligible ? <Link className="inline-flex min-h-10 items-center rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200" href={`/booking/showtimes/${encodeURIComponent(showtime.id)}`}>Choose seats</Link> : <p className="text-sm text-zinc-500">Booking is not available for this showtime.</p>}</CardContent></Card>
        ))}</div>
      </AsyncState>
    </section>
  );
}
