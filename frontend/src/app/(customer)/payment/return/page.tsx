'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { usePaymentQuery } from '@/lib/booking/booking-queries';

const STATUS_TEXT: Record<string, string> = {
  SUCCEEDED: 'Thanh toán thành công',
  PENDING: 'Đang chờ xác nhận thanh toán',
  PROCESSING: 'Đang xử lý thanh toán',
  FAILED: 'Thanh toán thất bại',
  REFUND_PENDING: 'Đang hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
};

export default function PaymentReturnPage() {
  const paymentId = useSearchParams().get('paymentId') ?? '';
  const query = usePaymentQuery(paymentId);
  const status = query.data?.status ?? '';
  const ok = status === 'SUCCEEDED';
  return (
    <AppShell>
      <ProtectedRoute roles={['CUSTOMER']}>
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className={`rounded-3xl border bg-neutral-900 p-6 text-center shadow-2xl sm:p-8 ${ok ? 'border-emerald-500/40' : 'border-white/10'}`}>
            {query.isPending && paymentId ? <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /> : null}
            {!paymentId ? <p className="text-xs text-neutral-400">Không tìm thấy giao dịch thanh toán.</p> : null}
            {query.error ? <p className="text-xs text-rose-300" role="alert">Không thể tải trạng thái thanh toán. Vui lòng thử lại.</p> : null}
            {query.data ? (
              <>
                <span className={`rounded-full px-3.5 py-1 text-xs font-bold ${ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{STATUS_TEXT[status] ?? status}</span>
                <h1 className="mt-3 font-display text-2xl font-extrabold text-white">Kết Quả Thanh Toán</h1>
                <p className="mt-1 text-xs text-neutral-400">Trạng thái thanh toán được xác nhận bởi hệ thống.</p>
              </>
            ) : null}
            <div className="flex gap-3 pt-6">
              <Link className="flex-1 rounded-xl bg-amber-500 py-3 text-xs font-bold text-neutral-950 transition hover:bg-amber-400" href="/account/bookings">Xem Vé Của Tôi</Link>
              <Link className="flex-1 rounded-xl bg-white/5 py-3 text-xs font-semibold text-neutral-200 transition hover:bg-white/10" href="/">Về Trang Chủ</Link>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    </AppShell>
  );
}
