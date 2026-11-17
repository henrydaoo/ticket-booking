'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppShell } from '@/components/layout/app-shell';
import { ManagerPage } from '@/features/catalog/manager-page';
import { CheckInPage } from '@/features/check-in/check-in-page';
import { useSyncExternalStore } from 'react';
import { readSession, subscribeToSession } from '@/lib/auth/auth-boundary';

function CheckInBoundary() {
  const session = useSyncExternalStore(subscribeToSession, readSession, () => null);
  const roles = session?.user.roles ?? [];
  return roles.includes('CINEMA_MANAGER') || roles.includes('PLATFORM_ADMIN')
    ? <ManagerPage view="check-in" />
    : <CheckInPage />;
}

export default function StaffCheckInBoundary() {
  return (
    <AppShell>
      <ProtectedRoute roles={['CINEMA_STAFF', 'CINEMA_MANAGER', 'PLATFORM_ADMIN']}>
        <CheckInBoundary />
      </ProtectedRoute>
    </AppShell>
  );
}
