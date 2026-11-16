import Link from 'next/link';
import type { Screen, Showtime } from '@/lib/catalog/catalog-client';
import { fmtTime, fmtVnd, startingPrice } from '@/lib/moonlight-format';

export function ShowtimePill({ showtime, screen }: { showtime: Showtime; screen?: Screen }) {
  const time = fmtTime(showtime.startAt);

  if (!showtime.bookingEligible) {
    return (
      <div className="flex min-w-[130px] cursor-not-allowed flex-col gap-1 rounded-xl border border-white/5 bg-neutral-950 px-3.5 py-2.5 opacity-60">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-sm font-bold tabular-nums text-neutral-500">{time}</span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400">Đã khóa</span>
        </div>
        <span className="truncate text-[10px] text-neutral-500">Suất chiếu chưa mở bán</span>
      </div>
    );
  }

  return (
    <Link className="group flex min-w-[130px] flex-col gap-1 rounded-xl border border-white/10 bg-neutral-900 px-3.5 py-2.5 text-left transition-all hover:border-amber-400/60 hover:bg-neutral-800" href={`/booking/showtimes/${showtime.id}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-base font-bold tabular-nums text-white transition group-hover:text-amber-400">{time}</span>
        <span className="text-[11px] font-semibold tabular-nums text-amber-400">{fmtVnd(startingPrice(showtime))}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="truncate text-neutral-400">{screen?.name ?? 'Phòng chiếu'}</span>
        <span className="tabular-nums text-emerald-400">{screen?.capacity ?? 0} ghế</span>
      </div>
    </Link>
  );
}
