'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';
import { readSession, subscribeToSession } from '@/lib/auth/auth-boundary';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

type ProtectedRouteProps = {
  children: ReactNode;
  fallback?: ReactNode;
  roles?: string[];
  requireMfa?: boolean;
};

export function ProtectedRoute({
  children,
  fallback = (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <Card className="w-full max-w-lg border-zinc-800 bg-zinc-900/80">
        <CardHeader className="items-center text-center">
          <LockKeyhole className="h-10 w-10 text-amber-400" />
          <h1 className="text-2xl font-semibold text-white">Sign in required</h1>
          <p className="text-zinc-400">You need an authenticated session to view this page.</p>
        </CardHeader>
        <CardContent className="flex justify-center gap-3">
          <Link className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200" href="/login">Sign in</Link>
          <Link className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800" href="/">Back to discovery</Link>
        </CardContent>
      </Card>
    </div>
  ),
  roles,
  requireMfa = false,
}: ProtectedRouteProps) {
  const roleKey = roles?.join('|') ?? '';
  const session = useSyncExternalStore(subscribeToSession, readSession, () => null);
  const allowedRoles = roleKey ? roleKey.split('|') : undefined;
  const hasRole = !allowedRoles || allowedRoles.some((role) => session?.user.roles.includes(role));
  const authorized = Boolean(session && hasRole && (!requireMfa || session.user.mfaCompleted));
  return authorized ? children : fallback;
}
