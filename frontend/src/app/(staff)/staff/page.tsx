'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppShell } from '@/components/layout/app-shell';
import { ManagerPage } from '@/features/catalog/manager-page';
import { CheckInPage } from '@/features/check-in/check-in-page';
import { useSyncExternalStore } from 'react';
import { readSession, subscribeToSession } from '@/lib/auth/auth-boundary';

function StaffWorkspace() {
  const session = useSyncExternalStore(subscribeToSession, readSession, () => null);
  const roles = session?.user.roles ?? [];
  return roles.includes('CINEMA_MANAGER') || roles.includes('PLATFORM_ADMIN') ? <ManagerPage view="showtimes" /> : <CheckInPage />;
}

export default function StaffBoundary() {
  return (
    <AppShell>
      <ProtectedRoute roles={['CINEMA_STAFF', 'CINEMA_MANAGER', 'PLATFORM_ADMIN']}>
        <StaffWorkspace />
      </ProtectedRoute>
    </AppShell>
  );
}
