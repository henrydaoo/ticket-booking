import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppShell } from '@/components/layout/app-shell';
import { ManagerPage } from '@/features/catalog/manager-page';

export default function StaffScreensPage() {
  return <AppShell><ProtectedRoute roles={['CINEMA_MANAGER', 'PLATFORM_ADMIN']}><ManagerPage view="screens" /></ProtectedRoute></AppShell>;
}
