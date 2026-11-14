import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  className,
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'success' | 'muted' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'success'
          ? 'bg-emerald-950 text-emerald-300'
          : variant === 'muted'
            ? 'bg-zinc-800 text-zinc-400'
            : 'bg-zinc-100 text-zinc-900',
        className,
      )}
      {...props}
    />
  );
}
