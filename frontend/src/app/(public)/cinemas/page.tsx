import { AppShell } from '@/components/layout/app-shell';
import { CinemasPage } from '@/features/cinema-showtimes/cinemas-page';

export default function CinemasRoute() {
  return <AppShell><CinemasPage /></AppShell>;
}
