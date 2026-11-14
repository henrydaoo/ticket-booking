import type { ReactNode } from 'react';
import Link from 'next/link';
import { Film } from 'lucide-react';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <Link className="mx-auto flex w-fit items-center gap-2 font-semibold text-white" href="/"><Film className="h-5 w-5" /> Cinema Booking</Link>
        {children}
      </div>
    </main>
  );
}
