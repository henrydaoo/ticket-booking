import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createBranch,
  createCinema,
  createMovie,
  createScreen,
  createShowtime,
  getCinema,
  getMovie,
  listBranches,
  listCinemas,
  listMovies,
  listScreens,
  listShowtimes,
  publishShowtime,
  updateMovie,
  updateScreenLayout,
  updateScreenPrices,
  updateShowtime,
} from './catalog-client';

export const catalogQueryKeys = {
  movies: ['catalog', 'movies'] as const,
  cinemas: ['catalog', 'cinemas'] as const,
  branches: ['catalog', 'branches'] as const,
  screens: (branchId?: string) => ['catalog', 'screens', branchId ?? 'all'] as const,
  showtimes: (filters: Record<string, string | undefined>) => ['catalog', 'showtimes', filters] as const,
};

export function useMoviesQuery(filters: { search?: string; status?: string } = {}) {
  return useQuery({
    queryKey: [...catalogQueryKeys.movies, filters] as const,
    queryFn: () => listMovies(filters),
  });
}

export function useMovieQuery(movieId: string) {
  return useQuery({
    queryKey: [...catalogQueryKeys.movies, movieId] as const,
    queryFn: () => getMovie(movieId),
    enabled: Boolean(movieId),
  });
}

export function useCinemaQuery() {
  return useQuery({
    queryKey: catalogQueryKeys.cinemas,
    queryFn: listCinemas,
  });
}

export function useCinemaDetailsQuery(cinemaId: string) {
  return useQuery({
    queryKey: [...catalogQueryKeys.cinemas, cinemaId] as const,
    queryFn: () => getCinema(cinemaId),
    enabled: Boolean(cinemaId),
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

export function useShowtimesQuery(filters: { movieId?: string; branchId?: string; from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: catalogQueryKeys.showtimes(filters),
    queryFn: () => listShowtimes(filters),
  });
}

function invalidateCatalog(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ['catalog'] });
}

export function useCreateMovieMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createMovie, onSuccess: () => invalidateCatalog(queryClient) });
}

export function useUpdateMovieMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateMovie>[1] }) => updateMovie(id, input), onSuccess: () => invalidateCatalog(queryClient) });
}

export function useCreateCinemaMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createCinema, onSuccess: () => invalidateCatalog(queryClient) });
}

export function useCreateBranchMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createBranch, onSuccess: () => invalidateCatalog(queryClient) });
}

export function useCreateScreenMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createScreen, onSuccess: () => invalidateCatalog(queryClient) });
}

export function useUpdateScreenLayoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ id, seats }: { id: string; seats: Parameters<typeof updateScreenLayout>[1] }) => updateScreenLayout(id, seats), onSuccess: () => invalidateCatalog(queryClient) });
}

export function useUpdateScreenPricesMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ id, prices }: { id: string; prices: Parameters<typeof updateScreenPrices>[1] }) => updateScreenPrices(id, prices), onSuccess: () => invalidateCatalog(queryClient) });
}

export function useCreateShowtimeMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createShowtime, onSuccess: () => invalidateCatalog(queryClient) });
}

export function useUpdateShowtimeMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateShowtime>[1] }) => updateShowtime(id, input), onSuccess: () => invalidateCatalog(queryClient) });
}

export function usePublishShowtimeMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ id, saleOpensAt }: { id: string; saleOpensAt?: string }) => publishShowtime(id, saleOpensAt), onSuccess: () => invalidateCatalog(queryClient) });
}
