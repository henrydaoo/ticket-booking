import { AppShell } from '@/components/layout/app-shell';
import { StatusMessage } from '@/components/ui/status-message';

export default function PublicPage() {
  return (
    <AppShell>
      <main>
        <h1>Cinema Ticket Booking</h1>
        <StatusMessage>Public route foundation is ready.</StatusMessage>
      </main>
    </AppShell>
  );
}
