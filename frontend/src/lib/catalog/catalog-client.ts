import { apiRequest } from '@/lib/api-client/client';

export type Movie = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  genre: string;
  ageRating: string;
  posterUrl?: string;
  trailerUrl?: string;
  status: 'COMING_SOON' | 'NOW_SHOWING' | 'ENDED';
};

export type Showtime = {
  id: string;
  movieId: string;
  branchId: string;
  screenId: string;
  startAt: string;
  endAt: string;
  saleOpensAt: string | null;
  reservationCutoffAt: string;
  status: 'PUBLISHED' | 'DRAFT';
  discoveryVisible: boolean;
  bookingEligible: boolean;
  prices: Record<string, number> | null;
};

export type Cinema = {
  id: string;
  name: string;
};

export type Branch = {
  id: string;
  cinemaId: string;
  name: string;
  address?: string;
};

export type Screen = {
  id: string;
  branchId: string;
  name: string;
  capacity: number;
  layoutVersion: number;
};

export function listMovies(): Promise<Movie[]> {
  return apiRequest<Movie[]>('/catalog/movies');
}

export function listCinemas(): Promise<Cinema[]> {
  return apiRequest<Cinema[]>('/catalog/cinemas');
}

export function listBranches(): Promise<Branch[]> {
  return apiRequest<Branch[]>('/catalog/branches');
}

export function listScreens(branchId?: string): Promise<Screen[]> {
  const query = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
  return apiRequest<Screen[]>(`/catalog/screens${query}`);
}

export function listShowtimes(filters: {
  movieId?: string;
  branchId?: string;
  from?: string;
  to?: string;
} = {}): Promise<Showtime[]> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return apiRequest<Showtime[]>(`/catalog/showtimes?${query.toString()}`);
}

export function getShowtime(id: string): Promise<Showtime> {
  return apiRequest<Showtime>(`/catalog/showtimes/${encodeURIComponent(id)}`);
}
