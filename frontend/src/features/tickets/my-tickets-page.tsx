'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { CompactPoster } from '@/features/movie-discovery/poster-card';
import { useBranchesQuery, useMoviesQuery, useScreensQuery, useShowtimesQuery } from '@/lib/catalog/catalog-queries';
import { fmtTime, fmtVnd } from '@/lib/moonlight-format';
import { getSeatMap, type Booking } from '@/lib/booking/booking-client';
import { bookingQueryKeys, useBookingsQuery } from '@/lib/booking/booking-queries';
import { useTicketsQuery } from '@/lib/tickets/ticket-queries';
import type { Ticket } from '@/lib/tickets/ticket-client';

const PAGE_SIZE = 5;
const BOOKING_STATUS: Record<Booking['status'], string> = {
  PENDING_PAYMENT: 'CHỜ THANH TOÁN',
  CONFIRMED: 'ĐÃ XÁC NHẬN',
  CANCELLED: 'ĐÃ HỦY',
  REFUND_PENDING: 'ĐANG HOÀN TIỀN',
  REFUNDED: 'ĐÃ HOÀN TIỀN',
};
const TICKET_STATUS: Record<Ticket['status'], string> = {
  VALID: 'CÒN HIỆU LỰC',
  USED: 'ĐÃ SỬ DỤNG',
  CANCELLED: 'ĐÃ HỦY',
};

function formatDateTime(iso?: string): string {
  return iso ? `${new Date(iso).toLocaleDateString('vi-VN')} lúc ${fmtTime(iso)}` : 'Chưa có thông tin';
}

export function MyTicketsPage() {
  const bookings = useBookingsQuery();
  const tickets = useTicketsQuery();
  const movies = useMoviesQuery().data ?? [];
  const branches = useBranchesQuery().data ?? [];
  const screens = useScreensQuery().data ?? [];
  const showtimes = useShowtimesQuery().data ?? [];
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Booking | null>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const allBookings = bookings.data ?? [];
  const totalPages = Math.max(1, Math.ceil(allBookings.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleBookings = allBookings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visibleShowtimeIds = [...new Set(visibleBookings.map((booking) => booking.showtimeId))];
  const seatMapQueries = useQueries({
    queries: visibleShowtimeIds.map((showtimeId) => ({
      queryKey: bookingQueryKeys.seatMap(showtimeId),
      queryFn: () => getSeatMap(showtimeId),
      enabled: Boolean(showtimeId),
    })),
  });
  const seatMaps = useMemo(
    () => new Map(visibleShowtimeIds.map((showtimeId, index) => [showtimeId, seatMapQueries[index]?.data])),
    [visibleShowtimeIds.join('|'), seatMapQueries],
  );
  const ticketsByBooking = useMemo(() => {
    const grouped = new Map<string, Ticket[]>();
    for (const ticket of tickets.data ?? []) {
      const current = grouped.get(ticket.bookingId) ?? [];
      current.push(ticket);
      grouped.set(ticket.bookingId, current);
    }
    return grouped;
  }, [tickets.data]);
  useEffect(() => {
    if (!detail) return;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetail(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [detail]);

  const context = (booking: Booking) => {
    const showtime = showtimes.find((item) => item.id === booking.showtimeId);
    return {
      showtime,
      movie: movies.find((item) => item.id === showtime?.movieId),
      branch: branches.find((item) => item.id === showtime?.branchId),
      screen: screens.find((item) => item.id === showtime?.screenId),
    };
  };
  const seatLabel = (showtimeId: string, seatId: string) =>
    seatMaps.get(showtimeId)?.seats.find((seat) => seat.seatId === seatId)?.label ?? `Mã ghế ${seatId}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-white">Vé Của Tôi & Lịch Sử Giao Dịch</h1>
          <p className="mt-1 text-sm text-neutral-400">Xem vé điện tử, mã QR và trạng thái các đơn đặt vé của bạn</p>
        </div>
        <span className="rounded-xl border border-white/10 bg-neutral-900 px-4 py-2 text-xs font-semibold text-neutral-300">
          {allBookings.length} đơn đặt vé
        </span>
      </div>

      {bookings.isPending || tickets.isPending ? (
        <div className="flex min-h-[30vh] items-center justify-center" role="status" aria-live="polite">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <span className="sr-only">Đang tải vé của bạn</span>
        </div>
      ) : null}
      {bookings.error ? (
        <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-sm text-rose-200" role="alert">
          Không thể tải lịch sử đơn hàng.
          <button className="ml-2 font-semibold underline" onClick={() => void bookings.refetch()} type="button">Thử tải lại đơn hàng</button>
        </div>
      ) : null}
      {tickets.error ? (
        <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-sm text-rose-200" role="alert">
          Không thể tải vé điện tử.
          <button className="ml-2 font-semibold underline" onClick={() => void tickets.refetch()} type="button">Thử tải lại vé</button>
        </div>
      ) : null}
      {!bookings.isPending && !bookings.error && allBookings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-900 p-12 text-center text-sm text-neutral-400">
          Bạn chưa có đơn đặt vé nào.
          <Link className="ml-1 font-semibold text-amber-400 hover:underline" href="/movies">Chọn phim và đặt vé ngay →</Link>
        </div>
      ) : null}

      {!bookings.isPending && !bookings.error ? (
        <div className="space-y-4 pt-6">
          {visibleBookings.map((booking) => {
            const { showtime, movie, branch } = context(booking);
            const issuedTickets = ticketsByBooking.get(booking.bookingId) ?? [];
            return (
              <article className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-neutral-900 p-5 sm:flex-row sm:items-center" key={booking.bookingId}>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400">{booking.bookingId.slice(0, 8).toUpperCase()}</span>
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">{BOOKING_STATUS[booking.status]}</span>
                    {issuedTickets.length ? <span className="text-[10px] font-semibold text-emerald-300">{issuedTickets.length} vé đã phát hành</span> : null}
                  </div>
                  <h2 className="font-display text-base font-bold text-white">{movie?.title ?? 'Phim'}</h2>
                  <p className="text-xs text-neutral-400">{branch?.name ?? 'Rạp'} · {formatDateTime(showtime?.startAt)} · {booking.seats.length} ghế</p>
                  {booking.status === 'REFUND_PENDING' ? <p className="text-xs text-amber-200">Yêu cầu hoàn tiền đang được xử lý.</p> : null}
                  {booking.status === 'REFUNDED' ? <p className="text-xs text-emerald-200">Khoản tiền của đơn này đã được hoàn.</p> : null}
                </div>
                <div className="flex shrink-0 flex-col justify-between gap-2.5 border-t border-white/5 pt-3 sm:items-end sm:border-t-0 sm:pt-0">
                  <span className="font-display text-base font-bold tabular-nums text-amber-400">{fmtVnd(booking.totalVnd)}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button className="rounded-xl border border-amber-500/30 bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/25" onClick={(event) => { returnFocusRef.current = event.currentTarget; setDetail(booking); }} type="button">Xem Chi Tiết & QR</button>
                    {booking.status === 'PENDING_PAYMENT' && showtime ? <Link className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-neutral-950 transition hover:bg-amber-400" href={`/booking/showtimes/${showtime.id}`}>Tiếp tục thanh toán</Link> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {tickets.data && visibleBookings.some((booking) => booking.status === 'CONFIRMED' && !ticketsByBooking.has(booking.bookingId)) ? (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100" role="status" aria-live="polite">
          Một số vé đang được phát hành sau khi thanh toán.{' '}
          <button className="font-semibold underline" onClick={() => void tickets.refetch()} type="button">Kiểm tra lại vé</button>
        </div>
      ) : null}

      {totalPages > 1 ? (
        <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Phân trang lịch sử vé">
          <button className="page-btn" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} type="button">← Trước</button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => (
            <button aria-current={item === currentPage ? 'page' : undefined} className={`page-btn ${item === currentPage ? 'active' : ''}`} key={item} onClick={() => setPage(item)} type="button">{item}</button>
          ))}
          <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} type="button">Sau →</button>
        </nav>
      ) : null}

      {detail ? (() => {
        const { showtime, movie, branch, screen } = context(detail);
        const detailTickets = ticketsByBooking.get(detail.bookingId) ?? [];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4" onClick={() => setDetail(null)}>
            <section aria-labelledby="ticket-detail-title" aria-modal="true" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#121215] shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog">
              <div className="space-y-5 p-5 sm:p-7">
                <div className="flex items-start justify-between border-b border-white/10 pb-4">
                  <div>
                    <span className="font-mono text-xs font-bold text-amber-400">{detail.bookingId.slice(0, 8).toUpperCase()}</span>
                    <h2 className="mt-1.5 font-display text-lg font-bold text-white sm:text-xl" id="ticket-detail-title">Vé Điện Tử & Chi Tiết Đơn</h2>
                  </div>
                  <button aria-label="Đóng chi tiết vé" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-neutral-400 hover:text-white" onClick={() => setDetail(null)} ref={closeButtonRef} type="button">✕</button>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-white/5 bg-neutral-950 p-4">
                  <CompactPoster movie={movie} />
                  <div className="min-w-0 flex-1 space-y-1">
                    {movie ? <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">{movie.ageRating}</span> : null}
                    <h3 className="truncate font-display text-sm font-bold text-white sm:text-base">{movie?.title ?? 'Phim'}</h3>
                    <p className="truncate text-xs text-neutral-400">{branch?.name ?? 'Rạp'} · {screen?.name ?? 'Phòng chiếu'}</p>
                    <p className="text-xs font-medium tabular-nums text-amber-400">{formatDateTime(showtime?.startAt)}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-neutral-300">Vé và mã QR ({detailTickets.length})</h3>
                  {detailTickets.length ? detailTickets.map((ticket) => (
                    <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-neutral-950 p-4 sm:flex-row sm:items-start" key={ticket.ticketId}>
                      {ticket.qrToken ? (
                        <div className="rounded-xl bg-white p-2">
                          <QRCodeSVG aria-label={`Mã QR vé ${ticket.ticketCode}`} size={152} value={ticket.qrToken} />
                        </div>
                      ) : (
                        <div className="flex h-[168px] w-[168px] items-center justify-center rounded-xl border border-white/10 text-center text-xs text-neutral-500">
                          Vé {TICKET_STATUS[ticket.status].toLowerCase()}
                        </div>
                      )}
                      <div className="space-y-2 text-center sm:text-left">
                        <p className="font-mono text-sm font-bold text-white">{ticket.ticketCode}</p>
                        <p className="text-xs text-neutral-400">{seatLabel(detail.showtimeId, ticket.seatId)} · {TICKET_STATUS[ticket.status]}</p>
                        <p className="text-[11px] text-neutral-500">Chỉ mã QR còn hiệu lực mới dùng để vào rạp.</p>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-white/10 bg-neutral-950 p-5 text-sm text-neutral-400" role="status">
                      {detail.status === 'CONFIRMED' ? 'Vé đang được phát hành.' : 'Đơn này chưa có vé điện tử.'}
                      <button className="ml-2 font-semibold text-amber-300 underline" onClick={() => void tickets.refetch()} type="button">Kiểm tra lại</button>
                    </div>
                  )}
                </div>

                <div className="space-y-2 rounded-xl border border-white/5 bg-neutral-950 p-4 text-xs">
                  <div className="flex justify-between text-neutral-400"><span>Phương thức thanh toán:</span><span className="font-medium text-white">Cổng VNPay</span></div>
                  {detail.status === 'PENDING_PAYMENT' ? <div className="flex justify-between text-neutral-400"><span>Hạn thanh toán:</span><span className="font-medium tabular-nums text-white">{formatDateTime(detail.paymentDeadlineAt)}</span></div> : null}
                  <div className="flex justify-between border-t border-white/10 pt-2 font-display text-sm font-bold text-white"><span>Tổng thanh toán:</span><span className="text-base tabular-nums text-amber-400">{fmtVnd(detail.totalVnd)}</span></div>
                </div>
                <div className="flex justify-end pt-2">
                  <button className="w-full rounded-xl bg-white/10 px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15 sm:w-auto" onClick={() => setDetail(null)} type="button">Đóng</button>
                </div>
              </div>
            </section>
          </div>
        );
      })() : null}
    </div>
  );
}
