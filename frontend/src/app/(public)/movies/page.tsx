import { AppShell } from '@/components/layout/app-shell';
import { MoviesPage } from '@/features/movie-discovery/movies-page';

export default function MoviesRoute() {
  return <AppShell><MoviesPage /></AppShell>;
}
