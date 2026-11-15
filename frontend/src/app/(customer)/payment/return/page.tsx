'use client';

import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { usePaymentQuery } from '@/lib/booking/booking-queries';
import { AsyncState } from '@/components/ui/async-state';

export default function PaymentReturnPage() {
  const paymentId = useSearchParams().get('paymentId') ?? '';
  const query = usePaymentQuery(paymentId);
  return <AppShell><ProtectedRoute><section className="mx-auto max-w-2xl"><h1 className="mb-6 text-3xl font-semibold text-white">Payment status</h1><AsyncState loading={query.isPending} error={query.error ? 'Payment status is unavailable. Please try again.' : ''} empty={!paymentId}><div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-6 text-zinc-300"><p>Status: <strong className="text-white">{query.data?.status}</strong></p><p className="mt-2">Payment status is determined by the backend.</p></div></AsyncState></section></ProtectedRoute></AppShell>;
}
