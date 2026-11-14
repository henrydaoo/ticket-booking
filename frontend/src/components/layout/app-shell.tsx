'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { Film, LogIn, UserRound, UserPlus } from 'lucide-react';
import { readSession, subscribeToSession } from '@/lib/auth/auth-boundary';

export function AppShell({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(subscribeToSession, readSession, () => null);

  return (
    <div className="min-h-screen bg-zinc-950">
      <header className="border-b border-zinc-800 bg-zinc-950/90">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link className="flex items-center gap-2 font-semibold text-white" href="/"><Film className="h-5 w-5" /> Cinema Booking</Link>
          <nav className="flex items-center gap-1">
            {session ? (
              <Link className="rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white" href="/account"><UserRound className="mr-2 inline h-4 w-4" />Account</Link>
            ) : (
              <>
                <Link className="rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white" href="/login"><LogIn className="mr-2 inline h-4 w-4" />Sign in</Link>
                <Link className="rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white" href="/register"><UserPlus className="mr-2 inline h-4 w-4" />Create account</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-12">{children}</main>
    </div>
  );
}
