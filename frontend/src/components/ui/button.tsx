import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-white px-4 py-2 text-zinc-950 hover:bg-zinc-200',
        secondary: 'bg-zinc-800 px-4 py-2 text-zinc-100 hover:bg-zinc-700',
        ghost: 'px-3 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white',
        destructive: 'bg-red-600 px-4 py-2 text-white hover:bg-red-500',
      },
      size: {
        default: 'min-h-10',
        sm: 'min-h-9',
        lg: 'min-h-11 px-6',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
