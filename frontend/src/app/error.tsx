'use client';

import { StatusMessage } from '@/components/ui/status-message';

export default function GlobalError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <StatusMessage>
      Something went wrong. <button onClick={reset}>Try again</button>
    </StatusMessage>
  );
}
