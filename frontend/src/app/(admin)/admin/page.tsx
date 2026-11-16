import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppShell } from '@/components/layout/app-shell';
import { AdminPage } from '@/features/catalog/admin-page';

export default function AdminBoundary() {
  return (
    <AppShell>
      <ProtectedRoute roles={['PLATFORM_ADMIN']} requireMfa>
        <AdminPage />
      </ProtectedRoute>
    </AppShell>
  );
}
