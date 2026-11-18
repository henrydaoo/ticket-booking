'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, userFacingApiError } from '@/lib/api-client/client';
import { useBookingMutation, useCancelReservationMutation, usePaymentMutation, useReservationMutation, useSeatMapQuery } from '@/lib/booking/booking-queries';
import { useMovieQuery, useShowtimesQuery, useBranchesQuery, useScreensQuery } from '@/lib/catalog/catalog-queries';
import { fmtVnd } from '@/lib/moonlight-format';
import { CompactPoster } from '@/features/movie-discovery/poster-card';

const selectionSchema = z.object({
  seats: z.array(z.string()).min(1, 'Vui lòng chọn ít nhất một ghế trống.'),
});
type SelectionValues = z.infer<typeof selectionSchema>;

function messageFor(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.code === 'RESERVATION_EXPIRED' || error.code === 'PAYMENT_DEADLINE_EXPIRED') {
      return 'Thời gian giữ chỗ đã kết thúc. Vui lòng chọn lại ghế.';
    }
    if (error.status === 409) return 'Một số ghế vừa được người khác đặt. Vui lòng xem lại sơ đồ ghế mới nhất.';
    return userFacingApiError(error, fallback);
  }
  return fallback;
}

const SEAT_TYPE_LABEL = { STANDARD: 'Standard', VIP: 'VIP', COUPLE: 'Couple' } as const;

export function BookingFlow({ showtimeId }: { showtimeId: string }) {
  const { data, isPending, error, refetch } = useSeatMapQuery(showtimeId);
  const showtimeQuery = useShowtimesQuery();
  const showtime = showtimeQuery.data?.find((item) => item.id === showtimeId);
  const movie = useMovieQuery(showtime?.movieId ?? '').data;
  const branch = useBranchesQuery().data?.find((item) => item.id === showtime?.branchId);
  const screen = useScreensQuery(showtime?.branchId).data?.find((item) => item.id === showtime?.screenId);
  const reservationMutation = useReservationMutation();
  const bookingMutation = useBookingMutation();
  const paymentMutation = usePaymentMutation();
  const cancelMutation = useCancelReservationMutation();
  const [reservation, setReservation] = useState<Awaited<ReturnType<typeof reservationMutation.mutateAsync>>>();
  const [booking, setBooking] = useState<Awaited<ReturnType<typeof bookingMutation.mutateAsync>>>();
  const [payment, setPayment] = useState<Awaited<ReturnType<typeof paymentMutation.mutateAsync>>>();
  const [now, setNow] = useState(() => Date.now());
  const form = useForm<SelectionValues>({ resolver: zodResolver(selectionSchema), defaultValues: { seats: [] } });
  const selectedIds = form.watch('seats');
  const reservationConflict = reservationMutation.error instanceof ApiError && reservationMutation.error.status === 409;

  useEffect(() => {
    if (!reservation || booking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [reservation, booking]);

  const step = payment || booking || reservation ? 2 : 1;
  const seatById = useMemo(() => new Map((data?.seats ?? []).map((seat) => [seat.seatId, seat])), [data?.seats]);
  const summarySeats = (booking ? booking.seats.map((seat) => seat.seatId) : reservation ? reservation.seatIds : selectedIds)
    .map((id) => seatById.get(id))
    .filter((seat): seat is NonNullable<typeof seat> => Boolean(seat));
  const total = booking ? booking.totalVnd : reservation ? reservation.totalVnd : summarySeats.reduce((sum, seat) => sum + seat.priceVnd, 0);
  const remainingMs = reservation ? Math.max(0, new Date(reservation.expiresAt).getTime() - now) : 0;
  const expired = Boolean(reservation) && remainingMs === 0;
  const timer = `${String(Math.floor(remainingMs / 60000)).padStart(2, '0')}:${String(Math.floor(remainingMs / 1000) % 60).padStart(2, '0')}`;

  const rows = useMemo(() => {
    const labels = Array.from(new Set((data?.seats ?? []).map((seat) => seat.row ?? seat.label.slice(0, 1)))).sort();
    return labels.map((row) => ({ row, seats: (data?.seats ?? []).filter((seat) => (seat.row ?? seat.label.slice(0, 1)) === row).sort((a, b) => (a.number ?? 0) - (b.number ?? 0)) }));
  }, [data?.seats]);

  const when = showtime ? new Date(showtime.startAt) : undefined;
  const whenText = when ? `${when.toLocaleDateString('vi-VN')} (${when.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })})` : '';
  const prices = showtime?.prices ?? {};

  const cancelReservation = async () => {
    if (!reservation) return;
    await cancelMutation.mutateAsync(reservation.reservationId);
    setReservation(undefined);
    reservationMutation.reset();
    form.setValue('seats', []);
    void refetch();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
        <Link className="text-xs font-medium text-neutral-400 hover:text-white" href={movie ? `/movies/${movie.id}` : '/movies'}>← Đổi suất chiếu</Link>
        <div className="flex items-center gap-2 text-xs">
          <span className={step === 1 ? 'font-bold text-amber-400' : 'text-neutral-400'}>1. Chọn chỗ ngồi</span>
          <span className="text-neutral-600">/</span>
          <span className={step === 2 ? 'font-bold text-amber-400' : 'text-neutral-400'}>2. Giữ chỗ & Thanh toán</span>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          {step === 1 ? (
            <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5 sm:p-8">
              {isPending ? <div className="flex min-h-[30vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div> : null}
              {error ? <p className="text-center text-xs text-rose-300" role="alert">{messageFor(error, 'Không thể tải sơ đồ ghế.')} <button className="underline" onClick={() => void refetch()} type="button">Thử lại</button></p> : null}
              {!isPending && !error && data && !data.inventoryReady ? <p className="text-center text-xs text-neutral-400">Suất chiếu này chưa sẵn sàng để đặt vé.</p> : null}
              {data?.inventoryReady ? (
                <form id="seat-form" onSubmit={form.handleSubmit(async (values) => {
                  const created = await reservationMutation.mutateAsync({
                    showtimeId,
                    seatIds: values.seats,
                    idempotencyKey: `reservation-${showtimeId}-${values.seats.slice().sort().join('-')}`,
                  });
                  setReservation(created);
                  setNow(Date.now());
                })}>
                  <div className="mx-auto mb-8 max-w-xl text-center">
                    <div className="cinema-screen-curve mb-2 h-6 w-full" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.35em] text-amber-400/80">MÀN HÌNH</span>
                  </div>
                  <div className="touch-pan-container overflow-x-auto pb-4">
                    <div className="flex min-w-[500px] flex-col items-center gap-2.5">
                      {rows.map(({ row, seats }) => (
                        <div className="flex items-center gap-3" key={row}>
                          <span className="w-5 text-right text-xs font-bold text-neutral-500">{row}</span>
                          <div className="flex items-center gap-1.5">
                            {seats.map((seat, index) => {
                              const selected = selectedIds.includes(seat.seatId);
                              const held = seat.status === 'HELD';
                              const unavailable = seat.status !== 'AVAILABLE';
                              const cls = seat.status === 'BOOKED' ? 'seat-booked-hatch cursor-not-allowed border-white/5 bg-neutral-950 text-neutral-700'
                                : held ? 'cursor-not-allowed border-orange-500/40 bg-orange-950/60 text-orange-400'
                                  : selected ? 'scale-105 border-amber-300 bg-amber-400 font-bold text-neutral-950 shadow-md shadow-amber-500/20'
                                    : seat.type === 'COUPLE' ? 'border-rose-400/40 bg-rose-950/70 text-rose-200 hover:bg-rose-900'
                                      : seat.type === 'VIP' ? 'border-indigo-400/40 bg-indigo-950/70 text-indigo-200 hover:bg-indigo-900'
                                        : 'border-neutral-600/60 bg-neutral-800/90 text-neutral-300 hover:bg-neutral-700';
                              return (
                                <span className="flex items-center gap-1.5" key={seat.seatId}>
                                  {index === Math.floor(seats.length / 2) ? <span className="w-4" /> : null}
                                  <button aria-label={`${seat.label} ${seat.status}`} className={`flex h-8 w-8 items-center justify-center rounded-b-sm rounded-t-lg border text-[10px] tabular-nums transition ${cls}`} disabled={unavailable} onClick={() => form.setValue('seats', selected ? selectedIds.filter((id) => id !== seat.seatId) : [...selectedIds, seat.seatId], { shouldValidate: true })} title={`${seat.label} · ${seat.type} · ${fmtVnd(seat.priceVnd)}`} type="button">
                                    {seat.status === 'BOOKED' ? '×' : held ? '⏳' : seat.number ?? seat.label}
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                          <span className="w-5 text-left text-xs font-bold text-neutral-500">{row}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-5 text-[11px] text-neutral-400 sm:grid-cols-3">
                    <div className="flex items-center gap-2"><span className="h-4 w-4 rounded border border-neutral-600 bg-neutral-800" /><span>Standard ({fmtVnd(prices.STANDARD)})</span></div>
                    <div className="flex items-center gap-2"><span className="h-4 w-4 rounded border border-indigo-400/40 bg-indigo-950" /><span>VIP ({fmtVnd(prices.VIP)})</span></div>
                    <div className="flex items-center gap-2"><span className="h-4 w-4 rounded border border-rose-400/40 bg-rose-950" /><span>Couple ({fmtVnd(prices.COUPLE)})</span></div>
                    <div className="flex items-center gap-2"><span className="h-4 w-4 rounded bg-amber-400" /><span className="font-medium text-white">Đang chọn</span></div>
                    <div className="flex items-center gap-2"><span className="h-4 w-4 rounded border border-orange-500/40 bg-orange-950 text-center text-[9px]">⏳</span><span>Đang giữ chỗ</span></div>
                    <div className="flex items-center gap-2"><span className="h-4 w-4 rounded border border-white/10 bg-neutral-950 text-center text-[10px]">×</span><span>Đã bán</span></div>
                  </div>
                  {form.formState.errors.seats ? <p className="mt-4 text-xs text-rose-300" role="alert">{form.formState.errors.seats.message}</p> : null}
                  {reservationMutation.error ? <div className="mt-4 space-y-3 text-xs" role="alert"><p className="text-rose-300">{messageFor(reservationMutation.error, 'Không thể giữ ghế.')}</p>{reservationConflict ? <button className="rounded-xl bg-white/5 px-4 py-2 font-semibold text-neutral-200 hover:bg-white/10" onClick={() => { form.setValue('seats', []); void refetch(); }} type="button">Xem lại ghế trống mới nhất</button> : null}</div> : null}
                </form>
              ) : null}
            </div>
          ) : (
            <div className="space-y-6 rounded-2xl border border-white/10 bg-neutral-900 p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Phiên giữ chỗ tạm thời</span>
                  <h2 className="mt-0.5 font-display text-xl font-bold text-white">Xác Nhận & Thanh Toán Đơn Hàng</h2>
                </div>
                {reservation && !booking ? (
                  <div className="rounded-xl border border-amber-500/35 bg-amber-500/15 px-4 py-2 text-right">
                    <span className="block text-[10px] text-amber-300">Thời gian còn lại</span>
                    <span className="font-mono text-lg font-bold tabular-nums text-amber-400">{timer}</span>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2 rounded-xl border border-white/10 bg-neutral-950 p-4 text-xs">
                <div className="flex justify-between"><span className="text-neutral-400">Mã {booking ? 'đơn hàng' : 'giữ chỗ'}:</span><span className="font-mono text-white">{(booking?.bookingId ?? reservation?.reservationId ?? '').slice(0, 8).toUpperCase()}</span></div>
                <div className="flex justify-between"><span className="text-neutral-400">Chính sách giá vé:</span><span className="text-emerald-400">Giá vé được cố định trong suốt phiên thanh toán</span></div>
              </div>

              {expired ? <p className="text-xs text-rose-300" role="alert">Thời gian giữ chỗ đã kết thúc. Ghế sẽ được giải phóng về trạng thái trống.</p> : null}
              {bookingMutation.error || cancelMutation.error || paymentMutation.error ? <p className="text-xs text-rose-300" role="alert">{messageFor(bookingMutation.error || cancelMutation.error || paymentMutation.error, 'Không thể hoàn tất thao tác.')}</p> : null}
              {payment ? <p className="text-xs text-neutral-300">Yêu cầu thanh toán đã sẵn sàng. <Link className="font-semibold text-amber-400 underline" href={`/payment/return?paymentId=${encodeURIComponent(payment.paymentId)}`}>Xem trạng thái thanh toán</Link></p> : null}

              {!payment ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  {!booking ? <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-xs font-semibold text-neutral-300 transition hover:bg-white/10" disabled={cancelMutation.isPending} onClick={() => void cancelReservation()} type="button">Hủy giữ chỗ</button> : null}
                  {reservation && !booking ? (
                    <button className="flex-1 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-neutral-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500 disabled:shadow-none" disabled={expired || bookingMutation.isPending} onClick={async () => setBooking(await bookingMutation.mutateAsync({ reservationId: reservation.reservationId, idempotencyKey: `booking-${reservation.reservationId}` }))} type="button">{bookingMutation.isPending ? 'Đang tạo đơn hàng...' : `Xác Nhận Đơn Hàng ${fmtVnd(total)}`}</button>
                  ) : null}
                  {booking ? (
                    <button className="flex-1 rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-neutral-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500" disabled={paymentMutation.isPending} onClick={async () => { const created = await paymentMutation.mutateAsync({ bookingId: booking.bookingId, idempotencyKey: `payment-${booking.bookingId}` }); setPayment(created); window.location.assign(created.paymentUrl); }} type="button">{paymentMutation.isPending ? 'Đang chuyển đến cổng thanh toán...' : `Xác Nhận Thanh Toán ${fmtVnd(total)} qua Cổng VNPay`}</button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="sticky top-24 rounded-2xl border border-white/10 bg-neutral-900 p-5 lg:col-span-4">
          <div className="flex items-center gap-3.5 border-b border-white/10 pb-4">
            <CompactPoster movie={movie} />
            <div className="min-w-0 flex-1">
              {movie ? <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">{movie.ageRating}</span> : null}
              <h3 className="mt-1 truncate font-display text-base font-bold text-white">{movie?.title}</h3>
              <p className="mt-0.5 truncate text-xs text-neutral-400">{branch?.name}</p>
              <p className="mt-0.5 text-xs font-medium tabular-nums text-amber-400">{screen?.name} · {whenText}</p>
            </div>
          </div>

          <div className="space-y-2 border-b border-white/10 py-4 text-xs">
            <span className="block font-medium text-neutral-400">Ghế đã chọn ({summarySeats.length})</span>
            {summarySeats.length === 0 ? <p className="italic text-neutral-500">Vui lòng chọn ghế trên sơ đồ phòng chiếu.</p> : summarySeats.map((seat) => (
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-neutral-950 px-3 py-2" key={seat.seatId}>
                <span><strong className="text-white">{seat.label}</strong> <span className="text-neutral-400">({SEAT_TYPE_LABEL[seat.type]})</span></span>
                <span className="font-semibold tabular-nums text-neutral-200">{fmtVnd(seat.priceVnd)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 py-4 text-xs">
            <p className="text-[11px] text-neutral-500">Giá vé đã bao gồm thuế VAT và phụ phí rạp tiêu chuẩn.</p>
            <div className="flex justify-between border-t border-white/10 pt-2 font-display text-base font-bold text-white">
              <span>Tổng thanh toán</span>
              <span className="tabular-nums text-amber-400">{fmtVnd(total)}</span>
            </div>
          </div>

          {step === 1 ? (
            <button className={`w-full rounded-xl px-4 py-3.5 text-sm font-bold transition ${selectedIds.length > 0 && !reservationMutation.isPending ? 'bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400' : 'cursor-not-allowed bg-neutral-800 text-neutral-500'}`} disabled={selectedIds.length === 0 || reservationMutation.isPending} form="seat-form" type="submit">{reservationMutation.isPending ? 'Đang giữ ghế...' : 'Tiếp Tục Giữ Chỗ (5 Phút)'}</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
