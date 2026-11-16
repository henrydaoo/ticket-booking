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
        'rounded-xl border px-4 py-3 text-sm leading-6',
        variant === 'destructive'
          ? 'border-red-900/80 bg-red-950/40 text-red-200'
          : 'border-amber-900/80 bg-amber-950/30 text-amber-100',
        className,
      )}
      {...props}
    />
  );
}
