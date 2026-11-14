import { AppShell } from '@/components/layout/app-shell';
import { StatusMessage } from '@/components/ui/status-message';
import { MovieBrowser } from '@/features/movie-discovery/movie-browser';
import { ShowtimeBrowser } from '@/features/cinema-showtimes/showtime-browser';
import { CinemaBrowser } from '@/features/cinema-showtimes/cinema-browser';

export default function PublicPage() {
  return (
    <AppShell>
      <main className="space-y-20">
        <section className="max-w-3xl space-y-5">
          <StatusMessage>Book your next experience</StatusMessage>
          <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl">Great stories deserve a great screen.</h1>
          <p className="text-lg leading-8 text-zinc-400">Discover movies, find your cinema, and explore showtimes in one place.</p>
        </section>
        <MovieBrowser />
        <CinemaBrowser />
        <ShowtimeBrowser />
      </main>
    </AppShell>
  );
}
