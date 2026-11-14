'use client';

import { StatusMessage } from '@/components/ui/status-message';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  reset,
}: {
  reset: () => void;
}) {
  return <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6"><div className="space-y-4 text-center"><StatusMessage>Something went wrong</StatusMessage><Button onClick={reset}>Try again</Button></div></main>;
}
