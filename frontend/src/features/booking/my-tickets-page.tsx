'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useBookingsQuery } from '@/lib/booking/booking-queries';
import type { Booking } from '@/lib/booking/booking-client';
import { useBranchesQuery, useMoviesQuery, useScreensQuery, useShowtimesQuery } from '@/lib/catalog/catalog-queries';
import { fmtTime, fmtVnd } from '@/lib/moonlight-format';
import { CompactPoster } from '@/features/movie-discovery/poster-card';

const PAGE_SIZE = 5;
const STATUS_TEXT: Record<Booking['status'], string> = {
  PENDING_PAYMENT: 'CHỜ THANH TOÁN',
  CONFIRMED: 'ĐÃ XÁC NHẬN',
  CANCELLED: 'ĐÃ HỦY',
  REFUND_PENDING: 'ĐANG HOÀN TIỀN',
  REFUNDED: 'ĐÃ HOÀN TIỀN',
};
const STATUS_BADGE: Record<Booking['status'], string> = {
  PENDING_PAYMENT: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
  CONFIRMED: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
  CANCELLED: 'border-white/10 bg-white/10 text-neutral-300',
  REFUND_PENDING: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
  REFUNDED: 'border-rose-500/30 bg-rose-500/15 text-rose-400',
};

export function MyTicketsPage() {
  const bookings = useBookingsQuery();
  const movies = useMoviesQuery().data ?? [];
  const branches = useBranchesQuery().data ?? [];
  const screens = useScreensQuery().data ?? [];
  const showtimes = useShowtimesQuery().data ?? [];
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Booking | null>(null);

  const all = bookings.data ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = all.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const context = (booking: Booking) => {
    const showtime = showtimes.find((item) => item.id === booking.showtimeId);
    return {
      showtime,
      movie: movies.find((item) => item.id === showtime?.movieId),
      branch: branches.find((item) => item.id === showtime?.branchId),
      screen: screens.find((item) => item.id === showtime?.screenId),
    };
  };
  const when = (iso?: string) => (iso ? `${new Date(iso).toLocaleDateString('vi-VN')} lúc ${fmtTime(iso)}` : '');

  const detailContext = detail ? context(detail) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-white">Vé Của Tôi & Lịch Sử Giao Dịch</h1>
          <p className="mt-1 text-sm text-neutral-400">Theo dõi trạng thái thanh toán và thông tin các đơn đặt vé của bạn</p>
        </div>
        <div className="flex w-full shrink-0 items-center rounded-xl border border-white/10 bg-neutral-900 p-1 sm:w-auto">
          <span className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-neutral-950 shadow-md shadow-amber-500/20"><span>🧾</span><span>Lịch Sử Đơn Hàng</span><span className="opacity-80">({all.length})</span></span>
        </div>
      </div>

      {bookings.isPending ? <div className="flex min-h-[30vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div> : null}
      {bookings.error ? <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-xs text-rose-200">Không thể tải lịch sử đơn hàng. <button className="font-semibold underline" onClick={() => void bookings.refetch()} type="button">Thử lại</button></div> : null}
      {!bookings.isPending && !bookings.error && all.length === 0 ? <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-900 p-12 text-center text-xs text-neutral-400">Bạn chưa có đơn đặt vé nào. <Link className="font-semibold text-amber-400 hover:underline" href="/movies">Chọn phim và đặt vé ngay →</Link></div> : null}

      <div className="space-y-4 pt-6">
        {visible.map((booking) => {
          const { showtime, movie, branch } = context(booking);
          return (
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-neutral-900 p-5 sm:flex-row sm:items-center" key={booking.bookingId}>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-400">{booking.bookingId.slice(0, 8).toUpperCase()}</span>
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">{STATUS_TEXT[booking.status]}</span>
                </div>
                <h3 className="font-display text-base font-bold text-white">{movie?.title ?? 'Phim'}</h3>
                <p className="text-xs text-neutral-400">{branch?.name} · {when(showtime?.startAt)} · {booking.seats.length} ghế</p>
              </div>
              <div className="flex shrink-0 flex-col justify-between gap-2.5 border-t border-white/5 pt-2 sm:items-end sm:border-t-0 sm:pt-0">
                <span className="font-display text-base font-bold tabular-nums text-amber-400">{fmtVnd(booking.totalVnd)}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="rounded-xl border border-amber-500/30 bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25" onClick={() => setDetail(booking)} type="button">Xem Chi Tiết</button>
                  {booking.status === 'PENDING_PAYMENT' && showtime ? <Link className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-neutral-950 transition hover:bg-amber-400" href={`/booking/showtimes/${showtime.id}`}>Tiếp tục thanh toán</Link> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalPages > 1 ? (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button className="page-btn" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} type="button">← Trước</button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => <button className={`page-btn ${item === currentPage ? 'active' : ''}`} key={item} onClick={() => setPage(item)} type="button">{item}</button>)}
          <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} type="button">Sau →</button>
        </div>
      ) : null}

      {detail && detailContext ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#121215] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="space-y-5 p-5 sm:p-7">
              <div className="flex items-start justify-between border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded border px-2.5 py-0.5 text-[10px] font-bold ${STATUS_BADGE[detail.status]}`}>{STATUS_TEXT[detail.status]}</span>
                    <span className="font-mono text-xs font-bold text-amber-400">{detail.bookingId.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <h2 className="mt-1.5 font-display text-lg font-bold text-white sm:text-xl">Chi Tiết Đơn Hàng</h2>
                </div>
                <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-neutral-400 hover:text-white" onClick={() => setDetail(null)} type="button">✕</button>
              </div>

              <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-neutral-950 p-4">
                <CompactPoster movie={detailContext.movie} />
                <div className="min-w-0 flex-1 space-y-1">
                  {detailContext.movie ? <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">{detailContext.movie.ageRating}</span> : null}
                  <h3 className="truncate font-display text-sm font-bold text-white sm:text-base">{detailContext.movie?.title ?? 'Phim'}</h3>
                  <p className="truncate text-xs text-neutral-400">{detailContext.branch?.name} · {detailContext.screen?.name}</p>
                  <p className="text-xs font-medium tabular-nums text-amber-400">{when(detailContext.showtime?.startAt)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-semibold text-neutral-300">Danh Sách Ghế Ngồi ({detail.seats.length} ghế)</span>
                <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5 bg-neutral-950 text-xs">
                  {detail.seats.map((seat, index) => (
                    <div className="flex items-center justify-between p-3" key={seat.seatId}>
                      <strong className="font-mono text-sm text-white">Ghế {index + 1}</strong>
                      <span className="font-semibold tabular-nums text-white">{fmtVnd(seat.priceVnd)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-white/5 bg-neutral-950 p-4 text-xs">
                <div className="flex justify-between text-neutral-400"><span>Phương thức thanh toán:</span><span className="font-medium text-white">Cổng VNPay</span></div>
                {detail.status === 'PENDING_PAYMENT' ? <div className="flex justify-between text-neutral-400"><span>Hạn thanh toán:</span><span className="font-medium tabular-nums text-white">{when(detail.paymentDeadlineAt)}</span></div> : null}
                <div className="flex justify-between border-t border-white/10 pt-2 font-display text-sm font-bold text-white"><span>Tổng số tiền thanh toán:</span><span className="text-base tabular-nums text-amber-400">{fmtVnd(detail.totalVnd)}</span></div>
              </div>

              <div className="flex justify-end pt-2">
                <button className="w-full rounded-xl bg-white/10 px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15 sm:w-auto" onClick={() => setDetail(null)} type="button">Đóng</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
