import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BookingFlow } from '@/features/booking/booking-flow';

export default async function ShowtimeBookingPage({ params }: { params: Promise<{ showtimeId: string }> }) {
  const { showtimeId } = await params;
  return <AppShell><ProtectedRoute><BookingFlow showtimeId={showtimeId} /></ProtectedRoute></AppShell>;
}
