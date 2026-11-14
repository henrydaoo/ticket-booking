import type { SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'flex h-10 w-full rounded-md border bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400',
        className,
      )}
      {...props}
    />
  );
}
