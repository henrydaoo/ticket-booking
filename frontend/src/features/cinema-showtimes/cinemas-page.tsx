'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useBranchesQuery, useMoviesQuery, useScreensQuery, useShowtimesQuery } from '@/lib/catalog/catalog-queries';
import { buildDates, dayRange, fmtDuration } from '@/lib/moonlight-format';
import { CompactPoster } from '@/features/movie-discovery/poster-card';
import { ShowtimePill } from './showtime-pill';

export function CinemasPage() {
  const dates = useMemo(() => buildDates(), []);
  const [selectedDate, setSelectedDate] = useState(dates[0].value);
  const [branchId, setBranchId] = useState('');
  const branches = useBranchesQuery().data ?? [];
  const movies = useMoviesQuery({ status: 'NOW_SHOWING' }).data ?? [];
  const screens = useScreensQuery().data ?? [];
  const currentBranch = branches.find((branch) => branch.id === branchId) ?? branches[0];
  const showtimesQuery = useShowtimesQuery({ branchId: currentBranch?.id, ...dayRange(selectedDate) });

  if (!currentBranch) return <div className="mx-auto max-w-7xl px-4 py-24 text-center text-sm text-neutral-400">Chưa có cụm rạp nào trong hệ thống.</div>;

  const published = (showtimesQuery.data ?? []).filter((item) => item.status === 'PUBLISHED' && item.discoveryVisible);
  const movieGroups = movies
    .map((movie) => ({ movie, showtimes: published.filter((item) => item.movieId === movie.id).sort((a, b) => a.startAt.localeCompare(b.startAt)) }))
    .filter((group) => group.showtimes.length > 0);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold text-white">Hệ Thống Cụm Rạp Moonlight Cinema</h1>
        <p className="mt-1 text-xs text-neutral-400 sm:text-sm">Chọn cụm rạp để theo dõi lịch chiếu và trải nghiệm công nghệ phòng chiếu hiện đại</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {branches.map((branch) => {
          const selected = branch.id === currentBranch.id;
          return (
            <button className={`rounded-2xl border p-5 text-left transition-all ${selected ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10' : 'border-white/10 bg-neutral-900 hover:border-white/20'}`} key={branch.id} onClick={() => setBranchId(branch.id)} type="button">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase ${selected ? 'text-amber-400' : 'text-neutral-400'}`}>Cụm Rạp</span>
                <span className={`h-2 w-2 rounded-full ${selected ? 'bg-amber-400' : 'bg-transparent'}`} />
              </div>
              <h3 className="mt-1.5 font-display text-base font-bold text-white">{branch.name}</h3>
              <p className="mt-1 line-clamp-1 text-xs text-neutral-400">{branch.address}</p>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <h2 className="font-display text-xl font-bold text-white">Lịch Chiếu Phim Tại {currentBranch.name}</h2>
          <span className="text-xs text-neutral-400">Ngày chiếu: <strong className="text-amber-400">{selectedDate}</strong></span>
        </div>

        <div className="flex gap-2.5 overflow-x-auto pb-2">
          {dates.map((date) => (
            <button className={`min-w-[110px] rounded-xl border px-4 py-3 text-left transition ${selectedDate === date.value ? 'border-amber-400 bg-amber-500 font-bold text-neutral-950' : 'border-white/10 bg-neutral-900 text-neutral-300'}`} key={date.value} onClick={() => setSelectedDate(date.value)} type="button">
              <span className="block text-[11px] uppercase">{date.label}</span>
              <span className="mt-0.5 block font-display text-sm font-bold tabular-nums">{date.dayNum}</span>
            </button>
          ))}
        </div>

        <div className="space-y-4 pt-2">
          {showtimesQuery.isPending ? <div className="rounded-2xl border border-white/10 bg-neutral-900 p-12 text-center text-xs text-neutral-400">Đang tải lịch chiếu...</div> : null}
          {!showtimesQuery.isPending && movieGroups.length === 0 ? <div className="rounded-2xl border border-white/10 bg-neutral-900 p-12 text-center text-xs text-neutral-400">Không có suất chiếu nào được lên lịch tại chi nhánh này vào ngày {selectedDate}.</div> : null}
          {movieGroups.map(({ movie, showtimes }) => (
            <div className="flex flex-col items-start gap-5 rounded-2xl border border-white/10 bg-neutral-900 p-5 transition hover:border-white/20 md:flex-row md:items-center" key={movie.id}>
              <div className="flex shrink-0 items-center gap-4">
                <CompactPoster movie={movie} />
                <div className="md:w-56">
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">{movie.ageRating}</span>
                  <Link className="mt-1 line-clamp-1 block cursor-pointer font-display text-base font-bold leading-snug text-white hover:text-amber-400" href={`/movies/${movie.id}`}>{movie.title}</Link>
                  <p className="mt-0.5 text-xs text-neutral-400">{fmtDuration(movie.durationMinutes)} · {movie.genre}</p>
                </div>
              </div>
              <div className="flex flex-1 flex-wrap gap-2.5">
                {showtimes.map((item) => <ShowtimePill key={item.id} screen={screens.find((screen) => screen.id === item.screenId)} showtime={item} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
