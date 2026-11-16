'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMoviesQuery } from '@/lib/catalog/catalog-queries';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fmtDuration } from '@/lib/moonlight-format';
import { FullPoster } from './poster-card';

const PAGE_SIZE = 10;
type Tab = 'NOW_SHOWING' | 'COMING_SOON' | 'ENDED';

export function MoviesPage() {
  const [tab, setTab] = useState<Tab>('NOW_SHOWING');
  const [genre, setGenre] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);
  const { data: movies = [], isPending } = useMoviesQuery({ status: tab, search: debouncedSearch });

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('movieStatus');
    if (status === 'COMING_SOON' || status === 'ENDED' || status === 'NOW_SHOWING') setTab(status);
  }, []);

  const genres = useMemo(() => ['ALL', ...Array.from(new Set(movies.map((movie) => movie.genre.split(',')[0].trim()).filter(Boolean)))], [movies]);
  const filtered = movies.filter((movie) => genre === 'ALL' || movie.genre.split(',').map((item) => item.trim()).includes(genre));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selectTab = (next: Tab) => { setTab(next); setGenre('ALL'); setPage(1); };
  const tabs: Array<[Tab, string]> = [['NOW_SHOWING', 'Đang Chiếu'], ['COMING_SOON', 'Sắp Chiếu'], ['ENDED', 'Đã Dừng Chiếu']];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-white">Danh Mục Phim Chiếu Rạp</h1>
          <p className="mt-1 text-sm text-neutral-400">Khám phá các siêu phẩm điện ảnh với chất lượng hình ảnh & âm thanh đỉnh cao</p>
        </div>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/10 bg-neutral-900 p-1 sm:inline-flex">
          {tabs.map(([value, label]) => (
            <button className={`rounded-lg px-4 py-2 text-xs font-semibold ${tab === value ? 'bg-amber-500 text-neutral-950' : 'text-neutral-400 hover:text-white'}`} key={value} onClick={() => selectTab(value)} type="button">{label}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 py-6 lg:flex-row">
        <div className="flex flex-wrap gap-1.5 self-start">
          {genres.map((item) => (
            <button className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${genre === item ? 'border-white bg-white font-bold text-neutral-950' : 'border-white/10 bg-neutral-900 text-neutral-400 hover:border-white/20'}`} key={item} onClick={() => { setGenre(item); setPage(1); }} type="button">{item === 'ALL' ? 'Tất cả thể loại' : item}</button>
          ))}
        </div>
        <input className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none lg:w-72" onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Tìm kiếm tên phim, đạo diễn..." type="text" value={search} />
      </div>

      {isPending ? <div className="flex min-h-[30vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div> : null}
      {!isPending && visible.length === 0 ? <div className="rounded-2xl bg-neutral-900 p-12 text-center text-xs text-neutral-400">Không tìm thấy phim phù hợp.</div> : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {visible.map((movie) => (
          <div className="group flex flex-col rounded-2xl border border-white/10 bg-neutral-900 p-3 transition hover:border-amber-500/40" key={movie.id}>
            <Link className="block cursor-pointer overflow-hidden rounded-xl" href={`/movies/${movie.id}`}><div className="transition-transform duration-300 group-hover:scale-105"><FullPoster movie={movie} /></div></Link>
            <div className="flex flex-1 flex-col px-0.5 pt-3">
              <Link className="line-clamp-1 cursor-pointer font-display text-sm font-bold text-neutral-100 transition group-hover:text-amber-400" href={`/movies/${movie.id}`}>{movie.title}</Link>
              <p className="mt-1 text-[11px] tabular-nums text-neutral-400">{fmtDuration(movie.durationMinutes)} · {movie.genre.split(',')[0]}</p>
              <div className="mt-3 border-t border-white/5 pt-2.5">
                {movie.status === 'NOW_SHOWING'
                  ? <Link className="block w-full rounded-xl bg-amber-500 px-3 py-2 text-center text-xs font-bold text-neutral-950 transition hover:bg-amber-400" href={`/movies/${movie.id}`}>Chọn Suất Chiếu</Link>
                  : <div className="w-full rounded-xl bg-white/5 px-3 py-2 text-center text-[11px] font-medium text-neutral-400">{movie.status === 'COMING_SOON' ? 'Sắp Khởi Chiếu' : 'Đã Dừng Chiếu'}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button className="page-btn" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} type="button">← Trước</button>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => <button className={`page-btn ${item === currentPage ? 'active' : ''}`} key={item} onClick={() => setPage(item)} type="button">{item}</button>)}
          <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} type="button">Sau →</button>
        </div>
      ) : null}
    </div>
  );
}
