import { AppShell } from '@/components/layout/app-shell';
import { HomePage } from '@/features/home/home-page';

export default function PublicPage() {
  return (
    <AppShell>
      <HomePage />
    </AppShell>
  );
}
