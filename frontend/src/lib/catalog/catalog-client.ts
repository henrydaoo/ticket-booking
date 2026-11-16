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

export type CinemaDetails = Cinema & {
  branches: Branch[];
  screens: Screen[];
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

export function listMovies(filters: { search?: string; status?: string } = {}): Promise<Movie[]> {
  const query = new URLSearchParams();
  if (filters.search) query.set('search', filters.search);
  if (filters.status) query.set('status', filters.status);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiRequest<Movie[]>(`/catalog/movies${suffix}`);
}

export function getMovie(id: string): Promise<Movie> {
  return apiRequest<Movie>(`/catalog/movies/${encodeURIComponent(id)}`);
}

export function listCinemas(): Promise<Cinema[]> {
  return apiRequest<Cinema[]>('/catalog/cinemas');
}

export function getCinema(id: string): Promise<CinemaDetails> {
  return apiRequest<CinemaDetails>(`/catalog/cinemas/${encodeURIComponent(id)}`);
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

export function createMovie(input: Omit<Movie, 'id'>): Promise<Movie> {
  return apiRequest<Movie>('/catalog/movies', { method: 'POST', body: JSON.stringify(input) });
}

export function updateMovie(id: string, input: Partial<Omit<Movie, 'id'>>): Promise<Movie> {
  return apiRequest<Movie>(`/catalog/movies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function createCinema(input: { name: string }): Promise<Cinema> {
  return apiRequest<Cinema>('/catalog/cinemas', { method: 'POST', body: JSON.stringify(input) });
}

export function createBranch(input: { cinemaId: string; name: string; address: string }): Promise<Branch> {
  return apiRequest<Branch>('/catalog/branches', { method: 'POST', body: JSON.stringify(input) });
}

export function createScreen(input: { branchId: string; name: string; capacity: number }): Promise<Screen> {
  return apiRequest<Screen>('/catalog/screens', { method: 'POST', body: JSON.stringify(input) });
}

export function updateScreenLayout(id: string, seats: Array<{ label: string; type: SeatType; row: string; number: number }>) {
  return apiRequest<Screen>(`/catalog/screens/${encodeURIComponent(id)}/layout`, {
    method: 'PUT',
    body: JSON.stringify({ seats }),
  });
}

export function updateScreenPrices(id: string, prices: Array<{ seatType: SeatType; priceVnd: number }>) {
  return apiRequest<Screen>(`/catalog/screens/${encodeURIComponent(id)}/prices`, {
    method: 'PUT',
    body: JSON.stringify({ prices }),
  });
}

export function createShowtime(input: {
  movieId: string;
  screenId: string;
  startAt: string;
  endAt: string;
  saleOpensAt?: string;
}): Promise<Showtime> {
  return apiRequest<Showtime>('/catalog/showtimes', { method: 'POST', body: JSON.stringify(input) });
}

export function updateShowtime(id: string, input: Partial<Parameters<typeof createShowtime>[0]>) {
  return apiRequest<Showtime>(`/catalog/showtimes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function publishShowtime(id: string, saleOpensAt?: string) {
  return apiRequest<Showtime>(`/catalog/showtimes/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    body: JSON.stringify(saleOpensAt ? { saleOpensAt } : {}),
  });
}

export type SeatType = 'STANDARD' | 'VIP' | 'COUPLE';
