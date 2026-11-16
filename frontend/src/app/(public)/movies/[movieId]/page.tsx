import { AppShell } from '@/components/layout/app-shell';
import { MovieDetailPage } from '@/features/movie-discovery/movie-detail-page';

export default async function MovieDetailRoute({ params }: { params: Promise<{ movieId: string }> }) {
  const { movieId } = await params;
  return <AppShell><MovieDetailPage movieId={movieId} /></AppShell>;
}
