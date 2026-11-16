'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useBranchesQuery, useMovieQuery, useScreensQuery, useShowtimesQuery } from '@/lib/catalog/catalog-queries';
import { buildDates, dayRange, fmtDuration } from '@/lib/moonlight-format';
import { ShowtimePill } from '@/features/cinema-showtimes/showtime-pill';
import { FullPoster, posterTheme } from './poster-card';

export function MovieDetailPage({ movieId }: { movieId: string }) {
  const dates = useMemo(() => buildDates(), []);
  const [selectedDate, setSelectedDate] = useState(dates[0].value);
  const [branchFilter, setBranchFilter] = useState('ALL');
  const movie = useMovieQuery(movieId);
  const branchesQuery = useBranchesQuery();
  const screens = useScreensQuery().data ?? [];
  const showtimesQuery = useShowtimesQuery({ movieId, branchId: branchFilter === 'ALL' ? undefined : branchFilter, ...dayRange(selectedDate) });

  if (movie.isPending) return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div>;
  if (!movie.data) return <div className="mx-auto max-w-7xl px-4 py-24 text-center text-sm text-neutral-400">Không tìm thấy phim này. <Link className="text-amber-400 hover:underline" href="/movies">Quay lại danh sách phim</Link></div>;

  const branches = branchesQuery.data ?? [];
  const published = (showtimesQuery.data ?? []).filter((item) => item.status === 'PUBLISHED' && item.discoveryVisible);
  const groups = branches
    .map((branch) => ({ branch, showtimes: published.filter((item) => item.branchId === branch.id).sort((a, b) => a.startAt.localeCompare(b.startAt)) }))
    .filter((group) => group.showtimes.length > 0);
  const theme = posterTheme(movie.data);

  return (
    <div>
      <div className="relative border-b border-white/10 bg-neutral-950">
        <div className={`absolute inset-0 bg-gradient-to-r ${theme.gradient} opacity-50`} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/85 to-[#09090B]/40" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link className="mb-6 inline-block text-xs font-medium text-neutral-400 hover:text-white" href="/movies">← Danh sách phim</Link>
          <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-12">
            <div className="max-w-[220px] md:col-span-3"><FullPoster movie={movie.data} /></div>
            <div className="space-y-4 md:col-span-9">
              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <span className="rounded-md border border-white/15 bg-white/10 px-2.5 py-0.5 font-bold text-white">{movie.data.ageRating}</span>
                <span className="rounded-md bg-amber-500/15 px-2.5 py-0.5 font-semibold text-amber-400">{movie.data.status === 'NOW_SHOWING' ? 'Đang Chiếu' : movie.data.status === 'COMING_SOON' ? 'Sắp Chiếu' : 'Đã Dừng Chiếu'}</span>
                <span className="tabular-nums text-neutral-400">{fmtDuration(movie.data.durationMinutes)}</span>
                <span className="text-neutral-300">{movie.data.genre}</span>
              </div>
              <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">{movie.data.title}</h1>
              <p className="max-w-3xl text-sm leading-relaxed text-neutral-300">{movie.data.description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Chọn Ngày & Suất Chiếu</h2>
            <p className="mt-0.5 text-xs text-neutral-400">Hệ thống tự động khóa đặt vé online trước 15 phút giờ bắt đầu</p>
          </div>
          <select className="rounded-xl border border-white/10 bg-neutral-900 px-3.5 py-2.5 text-xs text-white" onChange={(event) => setBranchFilter(event.target.value)} value={branchFilter}>
            <option value="ALL">Tất cả chi nhánh Moonlight</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </div>

        <div className="mb-6 flex gap-2.5 overflow-x-auto pb-4">
          {dates.map((date) => (
            <button className={`min-w-[110px] rounded-xl border px-4 py-3 text-left transition ${selectedDate === date.value ? 'border-amber-400 bg-amber-500 font-bold text-neutral-950' : 'border-white/10 bg-neutral-900 text-neutral-300'}`} key={date.value} onClick={() => setSelectedDate(date.value)} type="button">
              <span className="block text-[11px] uppercase">{date.label}</span>
              <span className="mt-0.5 block font-display text-sm font-bold tabular-nums">{date.dayNum}</span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {showtimesQuery.isPending ? <div className="rounded-2xl bg-neutral-900 p-8 text-center text-xs text-neutral-400">Đang tải suất chiếu...</div> : null}
          {!showtimesQuery.isPending && groups.length === 0 ? <div className="rounded-2xl bg-neutral-900 p-8 text-center text-xs text-neutral-400">Không có suất chiếu phù hợp trong ngày này.</div> : null}
          {groups.map(({ branch, showtimes }) => (
            <div className="rounded-2xl border border-white/10 bg-neutral-900 p-5" key={branch.id}>
              <div className="flex flex-col justify-between gap-2 border-b border-white/5 pb-4 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">{branch.name}</h3>
                  <p className="text-xs text-neutral-400">{branch.address}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-4">
                {showtimes.map((item) => <ShowtimePill key={item.id} screen={screens.find((screen) => screen.id === item.screenId)} showtime={item} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
