import { useQuery } from '@tanstack/react-query';
import {
  listBranches,
  listCinemas,
  listMovies,
  listScreens,
  listShowtimes,
} from './catalog-client';

export const catalogQueryKeys = {
  movies: ['catalog', 'movies'] as const,
  cinemas: ['catalog', 'cinemas'] as const,
  branches: ['catalog', 'branches'] as const,
  screens: (branchId?: string) => ['catalog', 'screens', branchId ?? 'all'] as const,
  showtimes: (filters: Record<string, string>) => ['catalog', 'showtimes', filters] as const,
};

export function useMoviesQuery() {
  return useQuery({ queryKey: catalogQueryKeys.movies, queryFn: listMovies });
}

export function useCinemaQuery() {
  return useQuery({
    queryKey: catalogQueryKeys.cinemas,
    queryFn: listCinemas,
  });
}

export function useBranchesQuery() {
  return useQuery({ queryKey: catalogQueryKeys.branches, queryFn: listBranches });
}

export function useScreensQuery(branchId?: string) {
  return useQuery({
    queryKey: catalogQueryKeys.screens(branchId),
    queryFn: () => listScreens(branchId),
  });
}

export function useShowtimesQuery() {
  return useQuery({
    queryKey: catalogQueryKeys.showtimes({}),
    queryFn: () => listShowtimes(),
  });
}
