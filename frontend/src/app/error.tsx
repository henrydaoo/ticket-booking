'use client';

import { StatusMessage } from '@/components/ui/status-message';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  reset,
}: {
  reset: () => void;
}) {
  return <main className="flex min-h-screen items-center justify-center bg-[#09090B] px-6"><div className="space-y-4 text-center"><StatusMessage>Đã có lỗi xảy ra</StatusMessage><Button onClick={reset}>Thử lại</Button></div></main>;
}
