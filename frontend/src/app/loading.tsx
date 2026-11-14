import { StatusMessage } from '@/components/ui/status-message';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6"><div className="space-y-4 text-center"><StatusMessage>Loading</StatusMessage><Skeleton className="h-2 w-48" /></div></main>;
}
