'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { readSession, subscribeToSession } from '@/lib/auth/auth-boundary';

type ProtectedRouteProps = {
  children: ReactNode;
  roles?: string[];
  requireMfa?: boolean;
};

function roleHome(roles: string[]) {
  if (roles.includes('PLATFORM_ADMIN')) return '/admin';
  if (roles.includes('CINEMA_MANAGER') || roles.includes('CINEMA_STAFF')) return '/staff';
  return '/';
}

export function ProtectedRoute({ children, roles, requireMfa = false }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const roleKey = roles?.join('|') ?? '';
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const session = useSyncExternalStore(subscribeToSession, readSession, () => null);
  const allowedRoles = roleKey ? roleKey.split('|') : undefined;
  const hasRole = !allowedRoles || allowedRoles.some((role) => session?.user.roles.includes(role));
  const authorized = Boolean(session && hasRole && (!requireMfa || session.user.mfaCompleted));

  useEffect(() => {
    if (!hydrated || authorized) return;
    if (!session) {
      const adminArea = pathname.startsWith('/admin');
      router.replace(adminArea ? '/admin/login' : '/login');
      return;
    }
    router.replace(hasRole ? '/admin/login' : roleHome(session.user.roles));
  }, [authorized, hasRole, hydrated, pathname, router, session]);

  return authorized ? children : null;
}
