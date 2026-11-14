import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Alert({
  className,
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'destructive' }) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border px-4 py-3 text-sm',
        variant === 'destructive'
          ? 'border-red-900/80 bg-red-950/40 text-red-200'
          : 'border-zinc-700 bg-zinc-900 text-zinc-300',
        className,
      )}
      {...props}
    />
  );
}
