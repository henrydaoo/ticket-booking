'use client';

import { useMemo } from 'react';
import { useBranchesQuery, useCinemaQuery, useScreensQuery } from '@/lib/catalog/catalog-queries';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function CinemaBrowser() {
  const cinemas = useCinemaQuery();
  const branches = useBranchesQuery();
  const screens = useScreensQuery();
  const loading = cinemas.isPending || branches.isPending || screens.isPending;
  const error = cinemas.error || branches.error || screens.error;
  const data = useMemo(() => ({
    cinemas: cinemas.data ?? [],
    branches: branches.data ?? [],
    screens: screens.data ?? [],
  }), [branches.data, cinemas.data, screens.data]);

  if (loading) return <section className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-36" /><Skeleton className="h-36" /></section>;
  if (error) return <Alert variant="destructive">Cinema information is unavailable.</Alert>;

  return (
    <section className="space-y-6">
      <div><p className="text-sm font-medium text-zinc-500">LOCATIONS</p><h2 className="text-3xl font-semibold text-white">Find a cinema</h2></div>
      <div className="grid gap-4 sm:grid-cols-2">
        {data.cinemas.map((cinema) => {
          const cinemaBranches = data.branches.filter((branch) => branch.cinemaId === cinema.id);
          return <Card key={cinema.id}><CardContent className="space-y-4 p-5"><h3 className="text-lg font-semibold text-white">{cinema.name}</h3>{cinemaBranches.length === 0 ? <p className="text-sm text-zinc-500">No branches available.</p> : null}<div className="space-y-3">{cinemaBranches.map((branch) => <div className="rounded-lg border bg-zinc-950/60 p-3" key={branch.id}><p className="font-medium text-zinc-200">{branch.name}</p>{branch.address ? <p className="text-sm text-zinc-500">{branch.address}</p> : null}<p className="mt-2 text-xs text-zinc-500">{data.screens.filter((screen) => screen.branchId === branch.id).length} screens</p></div>)}</div></CardContent></Card>;
        })}
      </div>
    </section>
  );
}
