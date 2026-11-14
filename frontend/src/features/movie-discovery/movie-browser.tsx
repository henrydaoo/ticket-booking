'use client';

import { useMemo, useState } from 'react';
import { useMoviesQuery } from '@/lib/catalog/catalog-queries';
import { AsyncState } from '@/components/ui/async-state';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function MovieBrowser() {
  const { data: movies = [], isPending, error } = useMoviesQuery();
  const [filters, setFilters] = useState({ query: '', status: '' });

  const filtered = useMemo(() => movies.filter((movie) =>
    (!filters.query || movie.title.toLowerCase().includes(filters.query.toLowerCase())) &&
    (!filters.status || movie.status === filters.status),
  ), [filters, movies]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm font-medium text-zinc-500">EXPLORE</p><h2 className="text-3xl font-semibold text-white">Now showing</h2></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input aria-label="Search movies" placeholder="Search movies..." value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} />
          <Select aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option><option value="COMING_SOON">Coming soon</option><option value="NOW_SHOWING">Now showing</option><option value="ENDED">Ended</option></Select>
        </div>
      </div>
      <AsyncState loading={isPending} error={error ? 'Movies are unavailable.' : ''} empty={!isPending && !error && filtered.length === 0}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((movie) => (
          <Card key={movie.id}><CardContent className="space-y-4 p-5"><div className="flex items-start justify-between gap-4"><h3 className="font-semibold text-white">{movie.title}</h3><Badge variant={movie.status === 'NOW_SHOWING' ? 'success' : 'muted'}>{movie.status.replace('_', ' ')}</Badge></div><p className="line-clamp-3 text-sm text-zinc-400">{movie.description}</p><p className="text-xs text-zinc-500">{movie.genre} · {movie.durationMinutes} min · {movie.ageRating}</p></CardContent></Card>
        ))}</div>
      </AsyncState>
    </section>
  );
}
