import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-11 w-full rounded-lg border bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none transition focus-visible:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400/30 placeholder:text-zinc-500',
        className,
      )}
      {...props}
    />
  );
}
