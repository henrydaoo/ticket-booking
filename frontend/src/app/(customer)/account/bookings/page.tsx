import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppShell } from '@/components/layout/app-shell';
import { MyTicketsPage } from '@/features/tickets/my-tickets-page';

export default function CustomerBookingsRoute() {
  return <AppShell><ProtectedRoute roles={['CUSTOMER']}><MyTicketsPage /></ProtectedRoute></AppShell>;
}
