'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useBranchesQuery, useMoviesQuery, useScreensQuery, useShowtimesQuery } from '@/lib/catalog/catalog-queries';
import type { Movie } from '@/lib/catalog/catalog-client';
import { CompactPoster, FullPoster, posterTheme } from '@/features/movie-discovery/poster-card';
import { buildDates, dayRange, fmtDuration, fmtTime, fmtVnd, startingPrice } from '@/lib/moonlight-format';

function youtubeEmbed(url?: string) {
  const id = url?.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/)?.[1];
  return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1` : null;
}

function TrailerModal({ movie, onClose }: { movie: Movie; onClose: () => void }) {
  const embed = youtubeEmbed(movie.trailerUrl);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#121215] shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Trailer Chính Thức</span>
              <h3 className="font-display text-lg font-bold text-white">{movie.title}</h3>
            </div>
            <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm text-white hover:bg-white/20" onClick={onClose} type="button">✕</button>
          </div>
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
            {embed ? <iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="h-full w-full" src={embed} title={`${movie.title} Trailer`} /> : <div className="flex h-full items-center justify-center text-xs text-neutral-400">Phim này chưa có trailer.</div>}
          </div>
          <div className="flex flex-col items-start justify-between gap-2 pt-1 text-xs sm:flex-row sm:items-center">
            <span className="text-neutral-400">{fmtDuration(movie.durationMinutes)} · {movie.genre}</span>
            <Link className="rounded-xl bg-amber-500 px-4 py-2 font-bold text-neutral-950 transition hover:bg-amber-400" href={`/movies/${movie.id}`}>Xem Suất Chiếu →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const dates = useMemo(() => buildDates(), []);
  const movies = useMoviesQuery();
  const branchesQuery = useBranchesQuery();
  const screensQuery = useScreensQuery();
  const [qbMovie, setQbMovie] = useState('');
  const [qbBranch, setQbBranch] = useState('');
  const [qbDate, setQbDate] = useState(dates[0].value);
  const [qbShowtime, setQbShowtime] = useState('');
  const [trailer, setTrailer] = useState<Movie | null>(null);
  const [notice, setNotice] = useState('');

  const allMovies = movies.data ?? [];
  const nowShowing = allMovies.filter((movie) => movie.status === 'NOW_SHOWING');
  const comingSoon = allMovies.filter((movie) => movie.status === 'COMING_SOON');
  const branches = branchesQuery.data ?? [];
  const screens = screensQuery.data ?? [];
  const featured = nowShowing[0] ?? allMovies[0];

  const todayShowtimes = useShowtimesQuery(dayRange(dates[0].value));
  const eligibleToday = (todayShowtimes.data ?? []).filter((item) => item.status === 'PUBLISHED' && item.discoveryVisible).sort((a, b) => a.startAt.localeCompare(b.startAt));

  const movieId = qbMovie || nowShowing[0]?.id || '';
  const branchId = qbBranch || branches[0]?.id || '';
  const quickShowtimes = useShowtimesQuery({ movieId, branchId, ...dayRange(qbDate) });
  const quickOptions = (quickShowtimes.data ?? []).filter((item) => item.bookingEligible).sort((a, b) => a.startAt.localeCompare(b.startAt));

  useEffect(() => {
    setQbShowtime(quickOptions[0]?.id ?? '');
  }, [quickShowtimes.data]);

  if (movies.isPending) return <div className="flex min-h-[50vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" /></div>;
  if (!featured) return <div className="mx-auto max-w-7xl px-4 py-24 text-center text-sm text-neutral-400">Chưa có phim nào trong hệ thống.</div>;

  const featuredTheme = posterTheme(featured);

  return (
    <>
      {trailer ? <TrailerModal movie={trailer} onClose={() => setTrailer(null)} /> : null}

      {/* 1. HERO SPOTLIGHT */}
      <section className="relative overflow-hidden border-b border-white/10 bg-neutral-950">
        <div className={`absolute inset-0 bg-gradient-to-r ${featuredTheme.gradient} opacity-40`} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/90 to-transparent" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-12 lg:px-8">
          <div className="space-y-4 lg:col-span-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              Suất Chiếu Đỉnh Cao Đang Mở Bán
            </div>
            <h1 className="font-display text-3xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">{featured.title}</h1>
            <div className="flex flex-wrap items-center gap-2.5 text-xs tabular-nums text-neutral-300 sm:gap-3 sm:text-sm">
              <span className="rounded-md border border-white/15 bg-white/10 px-2.5 py-0.5 font-bold text-white">{featured.ageRating}</span>
              <span>{fmtDuration(featured.durationMinutes)}</span>
              <span className="text-neutral-600">•</span>
              <span>{featured.genre}</span>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-neutral-300">{featured.description}</p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link className="rounded-xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-neutral-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400" href={`/movies/${featured.id}`}>Đặt Vé Ngay →</Link>
              <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-neutral-900 px-5 py-3.5 text-sm font-semibold text-neutral-200 transition hover:bg-neutral-800" onClick={() => setTrailer(featured)} type="button"><span>🎬</span> Xem Trailer</button>
              <Link className="rounded-xl bg-white/5 px-5 py-3.5 text-sm font-semibold text-neutral-300 transition hover:bg-white/10" href="/movies">Xem Tất Cả Phim</Link>
            </div>
          </div>
          <div className="ml-auto hidden w-full max-w-[260px] lg:col-span-4 lg:block"><FullPoster movie={featured} /></div>
        </div>
      </section>

      {/* 2. QUICK TICKET BOOKING BAR */}
      <section className="relative z-20 mx-auto -mt-6 max-w-7xl px-4 sm:-mt-8 sm:px-6 lg:px-8">
        <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-neutral-900/95 p-4 shadow-2xl shadow-black/80 backdrop-blur-xl sm:p-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-400"><span>⚡</span> Đặt Vé Nhanh Trực Tuyến</span>
            <span className="hidden text-[11px] text-neutral-400 sm:inline">Giữ ghế 5 phút · Nhận vé QR tức thì</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-400">1. Chọn Phim</label>
              <select className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none" onChange={(event) => setQbMovie(event.target.value)} value={movieId}>
                {nowShowing.map((movie) => <option key={movie.id} value={movie.id}>{movie.title}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-400">2. Chọn Rạp</label>
              <select className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none" onChange={(event) => setQbBranch(event.target.value)} value={branchId}>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-400">3. Chọn Ngày</label>
              <select className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none" onChange={(event) => setQbDate(event.target.value)} value={qbDate}>
                {dates.map((date) => <option key={date.value} value={date.value}>{date.label} ({date.value})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-neutral-400">4. Chọn Suất Chiếu</label>
              <div className="flex gap-2">
                <select className="flex-1 rounded-xl border border-white/10 bg-neutral-950 px-3 py-2.5 text-xs text-amber-300 focus:border-amber-400 focus:outline-none" onChange={(event) => setQbShowtime(event.target.value)} value={qbShowtime}>
                  {quickOptions.length > 0 ? quickOptions.map((item) => <option key={item.id} value={item.id}>{fmtTime(item.startAt)} ({screens.find((screen) => screen.id === item.screenId)?.name ?? 'Phòng chiếu'}) — {fmtVnd(startingPrice(item))}</option>) : <option value="">Hôm nay không còn suất</option>}
                </select>
                <Link aria-disabled={!qbShowtime} className="shrink-0 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-neutral-950 shadow-md shadow-amber-500/20 transition hover:bg-amber-400" href={qbShowtime ? `/booking/showtimes/${qbShowtime}` : '#'} onClick={(event) => { if (!qbShowtime) { event.preventDefault(); setNotice('Vui lòng chọn suất chiếu khả dụng để tiếp tục.'); } }}>Đặt Vé</Link>
              </div>
            </div>
          </div>
          {notice ? <p className="text-[11px] text-amber-300" role="status">{notice}</p> : null}
        </div>
      </section>

      {/* 3. PHIM ĐANG CHIẾU RẠP */}
      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /><h2 className="font-display text-2xl font-bold text-white">Phim Đang Chiếu Rạp</h2></div>
            <p className="mt-1 text-xs text-neutral-400">Định dạng IMAX Laser 4K, Dolby Atmos và Ghế Đôi Recliner cao cấp</p>
          </div>
          <Link className="flex items-center gap-1 text-xs font-semibold text-amber-400 transition hover:text-amber-300" href="/movies?movieStatus=NOW_SHOWING"><span>Xem tất cả phim</span><span>→</span></Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {nowShowing.slice(0, 4).map((movie) => (
            <div className="group flex flex-col rounded-2xl border border-white/10 bg-neutral-900 p-3 shadow-xl transition hover:border-amber-500/40" key={movie.id}>
              <Link className="block cursor-pointer overflow-hidden rounded-xl" href={`/movies/${movie.id}`}><div className="transition-transform duration-300 group-hover:scale-105"><FullPoster movie={movie} /></div></Link>
              <div className="flex flex-1 flex-col justify-between px-0.5 pt-3">
                <div>
                  <Link className="line-clamp-1 cursor-pointer font-display text-sm font-bold text-neutral-100 transition group-hover:text-amber-400 sm:text-base" href={`/movies/${movie.id}`}>{movie.title}</Link>
                  <p className="mt-1 text-[11px] tabular-nums text-neutral-400">{fmtDuration(movie.durationMinutes)} · {movie.genre.split(',')[0]}</p>
                </div>
                <div className="mt-3 border-t border-white/5 pt-2.5">
                  <Link className="block w-full rounded-xl bg-amber-500 px-3 py-2.5 text-center text-xs font-bold text-neutral-950 shadow-sm transition hover:bg-amber-400" href={`/movies/${movie.id}`}>Chọn Suất Chiếu</Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. SUẤT CHIẾU HÔM NAY */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Lịch Chiếu Hôm Nay ({dates[0].value})</h2>
            <p className="mt-0.5 text-xs text-neutral-400">Đặt chỗ trực tuyến thuận tiện · Cập nhật ghế trống theo thời gian thực</p>
          </div>
          <Link className="text-xs font-semibold text-amber-400 transition hover:text-amber-300" href="/cinemas">Xem lịch theo rạp →</Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {eligibleToday.slice(0, 6).map((item) => {
            const movie = allMovies.find((entry) => entry.id === item.movieId);
            const branch = branches.find((entry) => entry.id === item.branchId);
            const screen = screens.find((entry) => entry.id === item.screenId);
            const body = (
              <>
                <div className="flex min-w-0 items-center gap-3">
                  <CompactPoster movie={movie} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md px-2 py-0.5 font-display text-xs tabular-nums ${item.bookingEligible ? 'bg-amber-500/15 font-bold text-amber-400' : 'bg-white/5 text-neutral-400'}`}>{fmtTime(item.startAt)}</span>
                      <span className="truncate text-[11px] text-neutral-400">{branch?.name}</span>
                    </div>
                    <h3 className="mt-1 truncate font-display text-sm font-bold text-white transition group-hover:text-amber-400">{movie?.title}</h3>
                    <p className="mt-0.5 text-[11px] text-neutral-400">{screen?.name} · {item.bookingEligible ? `${screen?.capacity ?? 0} ghế` : 'Chưa mở bán'}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block text-xs font-bold tabular-nums text-neutral-200">{fmtVnd(startingPrice(item))}</span>
                  <span className={`mt-1 inline-block text-[11px] font-semibold ${item.bookingEligible ? 'text-amber-400' : 'text-neutral-500'}`}>{item.bookingEligible ? 'Đặt vé →' : 'Đã đóng'}</span>
                </div>
              </>
            );
            return item.bookingEligible
              ? <Link className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-4 transition hover:border-amber-500/50" href={`/booking/showtimes/${item.id}`} key={item.id}>{body}</Link>
              : <div className="group flex cursor-not-allowed items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-950 p-4 opacity-65 transition" key={item.id}>{body}</div>;
          })}
        </div>
      </section>

      {/* 5. PHIM SẮP KHỞI CHIẾU */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" /><h2 className="font-display text-2xl font-bold text-white">Phim Sắp Khởi Chiếu</h2></div>
            <p className="mt-1 text-xs text-neutral-400">Các siêu phẩm điện ảnh bom tấn chuẩn bị đổ bộ tại toàn bộ hệ thống rạp Moonlight Cinema</p>
          </div>
          <Link className="flex items-center gap-1 text-xs font-semibold text-amber-400 transition hover:text-amber-300" href="/movies?movieStatus=COMING_SOON"><span>Xem tất cả phim sắp chiếu</span><span>→</span></Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2">
          {comingSoon.slice(0, 2).map((movie) => (
            <div className="group flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-neutral-900/90 p-4 shadow-xl transition hover:border-amber-500/40 sm:flex-row sm:items-start sm:gap-5 sm:p-5" key={movie.id}>
              <Link className="w-32 shrink-0 cursor-pointer overflow-hidden rounded-xl shadow-lg transition-transform duration-300 group-hover:scale-105 sm:w-40" href={`/movies/${movie.id}`}><FullPoster movie={movie} /></Link>
              <div className="flex h-full w-full min-w-0 flex-1 flex-col justify-between space-y-2.5 text-left">
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">Sắp khởi chiếu</span>
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">{movie.ageRating}</span>
                  </div>
                  <Link className="line-clamp-1 cursor-pointer font-display text-lg font-extrabold text-white transition group-hover:text-amber-400 sm:text-xl" href={`/movies/${movie.id}`}>{movie.title}</Link>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-300">{movie.description}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px] text-neutral-400"><span>{movie.genre}</span></div>
                </div>
                <div className="flex items-center gap-2.5 border-t border-white/5 pt-3">
                  <Link className="flex-1 rounded-xl bg-amber-500 px-3 py-2 text-center text-xs font-bold text-neutral-950 shadow-md shadow-amber-500/20 transition hover:bg-amber-400" href={`/movies/${movie.id}`}>Xem Chi Tiết</Link>
                  <button className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-white/10" onClick={() => setTrailer(movie)} type="button"><span>🎬</span> Trailer</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. CÔNG NGHỆ TRÌNH CHIẾU */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-400">Chuẩn Mực Điện Ảnh</span>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-white sm:text-3xl">Công Nghệ Trình Chiếu Đỉnh Cao</h2>
          <p className="mt-2 text-xs text-neutral-400 sm:text-sm">Mang đến trải nghiệm nghe nhìn choáng ngợp với các công nghệ phòng chiếu hiện đại nhất thế giới</p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="group space-y-3 rounded-2xl border border-white/10 bg-neutral-900 p-6 transition hover:border-amber-500/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-xl font-black text-amber-400">IMAX</div>
            <h3 className="font-display text-lg font-bold text-white transition group-hover:text-amber-400">IMAX® with Laser 4K</h3>
            <p className="text-xs leading-relaxed text-neutral-400">Màn hình cong vô cực cao 24 mét cùng hệ thống máy chiếu Laser kép thế hệ mới, cho độ sáng gấp đôi và độ tương phản đen tuyệt đối chuẩn điện ảnh Hollywood.</p>
            <div className="flex items-center gap-1.5 pt-2 text-[11px] font-semibold text-amber-400"><span>Trang bị tại Moonlight Landmark 81</span></div>
          </div>
          <div className="group space-y-3 rounded-2xl border border-white/10 bg-neutral-900 p-6 transition hover:border-amber-500/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-xl font-black text-sky-400">360°</div>
            <h3 className="font-display text-lg font-bold text-white transition group-hover:text-sky-400">Dolby Atmos® Âm Thanh Vòm</h3>
            <p className="text-xs leading-relaxed text-neutral-400">Hệ thống 64 loa độc lập bao phủ toàn bộ trần và vách phòng chiếu, tái hiện âm thanh 3D chuyển động theo từng hạt cát và làn gió xung quanh bạn.</p>
            <div className="flex items-center gap-1.5 pt-2 text-[11px] font-semibold text-sky-400"><span>Đạt chuẩn Dolby Audio Certification</span></div>
          </div>
          <div className="group space-y-3 rounded-2xl border border-white/10 bg-neutral-900 p-6 transition hover:border-amber-500/40">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-xl font-black text-rose-400">VIP</div>
            <h3 className="font-display text-lg font-bold text-white transition group-hover:text-rose-400">Moonlight Gold Class Recliner</h3>
            <p className="text-xs leading-relaxed text-neutral-400">Ghế sofa da Nappa điều khiển điện ngả 160°, bàn ăn riêng tư cùng dịch vụ phục vụ rượu vang, bắp rang bơ hữu cơ tận chỗ từ đội ngũ tiếp viên chuyên nghiệp.</p>
            <div className="flex items-center gap-1.5 pt-2 text-[11px] font-semibold text-rose-400"><span>Có tại mọi cụm rạp Moonlight</span></div>
          </div>
        </div>
      </section>

      {/* 7. PHÂN HẠNG GHẾ */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-400">Thiết Kế Không Gian Phòng Chiếu</span>
          <h2 className="mt-2 font-display text-2xl font-extrabold text-white sm:text-3xl">3 Phân Hạng Ghế Chuẩn Điện Ảnh</h2>
          <p className="mt-2 text-xs text-neutral-400 sm:text-sm">Mỗi vị trí ngồi đều được tính toán góc nhìn tối ưu, đảm bảo trải nghiệm nghe nhìn trọn vẹn nhất</p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="group flex flex-col justify-between space-y-4 rounded-2xl border border-white/10 bg-neutral-900 p-6 transition hover:border-amber-500/30">
            <div className="space-y-3">
              <div className="flex items-center justify-between"><span className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-neutral-200">Hàng A – D</span><span className="text-xs font-bold tabular-nums text-neutral-300">Từ 85.000đ</span></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-neutral-800 text-xl text-white">💺</div>
              <h3 className="font-display text-lg font-bold text-white transition group-hover:text-amber-400">Ghế Tiêu Chuẩn (Standard)</h3>
              <p className="text-xs leading-relaxed text-neutral-400">Nệm êm ái bọc nỉ cao cấp, khoảng để chân rộng rãi 1.1m. Vị trí bao quát toàn cảnh màn hình, độ nghiêng hợp lý không gây mỏi cổ suốt thời gian xem phim.</p>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs"><span className="text-neutral-500">Góc nhìn: 36° Toàn cảnh</span><Link className="font-semibold text-amber-400 hover:underline" href="/movies">Chọn ghế →</Link></div>
          </div>
          <div className="group relative flex flex-col justify-between space-y-4 rounded-2xl border border-amber-500/40 bg-neutral-900 p-6 shadow-xl shadow-amber-500/10 transition">
            <div className="absolute -top-3 right-6 rounded-full bg-amber-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-950 shadow">Điểm Ngọt (Sweet Spot)</div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><span className="rounded-lg border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300">Hàng E – H</span><span className="text-xs font-bold tabular-nums text-amber-400">Từ 110.000đ</span></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/20 text-xl text-amber-400">👑</div>
              <h3 className="font-display text-lg font-bold text-white transition group-hover:text-amber-400">Ghế VIP Hoàng Kim</h3>
              <p className="text-xs leading-relaxed text-neutral-300">Tọa độ trung tâm hoàn hảo: vuông góc 90° trực diện tâm màn hình, âm thanh vòm Dolby Atmos hội tụ cân bằng đa chiều nhất phòng chiếu, không méo hình.</p>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs"><span className="font-medium text-amber-400/80">Góc nhìn: 45° Chuẩn THX</span><Link className="font-semibold text-amber-400 hover:underline" href="/movies">Chọn ghế →</Link></div>
          </div>
          <div className="group flex flex-col justify-between space-y-4 rounded-2xl border border-white/10 bg-neutral-900 p-6 transition hover:border-rose-500/40">
            <div className="space-y-3">
              <div className="flex items-center justify-between"><span className="rounded-lg border border-rose-500/30 bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-300">Hàng J (Cuối phòng)</span><span className="text-xs font-bold tabular-nums text-rose-300">210.000đ / cặp</span></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/20 text-xl text-rose-400">💕</div>
              <h3 className="font-display text-lg font-bold text-white transition group-hover:text-rose-400">Ghế Đôi Sweetbox (Couple)</h3>
              <p className="text-xs leading-relaxed text-neutral-400">Sofa đôi không vách ngăn ở giữa, thành tựa đầu cao tạo không gian riêng tư trọn vẹn cho các cặp đôi. Bố trí tại hàng ghế cuối cùng với tầm nhìn trọn vẹn màn chiếu.</p>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs"><span className="text-neutral-500">Dành cho 2 người lớn</span><Link className="font-semibold text-rose-300 hover:underline" href="/movies">Chọn ghế →</Link></div>
          </div>
        </div>
      </section>

      {/* 8. QUY TRÌNH 4 BƯỚC */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <div className="space-y-8 rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 to-neutral-950 p-6 shadow-2xl sm:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-400">Quy Trình Tiện Lợi</span>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-white sm:text-3xl">Trải Nghiệm Mua Vé & Vào Rạp 4 Bước</h2>
            <p className="mt-2 text-xs text-neutral-400 sm:text-sm">Hoàn toàn trực tuyến, không mất thời gian xếp hàng chờ đợi tại quầy vé rạp</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['01', 'Chọn Phim & Suất', 'Khám phá danh mục phim đang chiếu, chọn chi nhánh rạp gần bạn và khung giờ chiếu thuận tiện.', 'border-amber-500/30 bg-amber-500/15 text-amber-400'],
              ['02', 'Chọn Ghế & Giữ 5 Phút', 'Sơ đồ ghế 2D cập nhật thời gian thực. Hệ thống kích hoạt khóa giữ chỗ 5 phút chống tranh chấp ghế.', 'border-amber-500/30 bg-amber-500/15 text-amber-400'],
              ['03', 'Thanh Toán VNPay', 'Quét mã QR qua cổng VNPay tức thì, minh bạch thuế GTGT 8% và xuất biên lai thanh toán an toàn.', 'border-amber-500/30 bg-amber-500/15 text-amber-400'],
              ['04', 'Quét Vé QR Vào Rạp', 'Nhận vé QR token ngay trong mục "Vé Của Tôi". Xuất trình tại cửa phòng chiếu là vào xem phim ngay.', 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'],
            ].map(([step, title, text, tone]) => (
              <div className="relative space-y-3 rounded-2xl border border-white/5 bg-neutral-950/80 p-5" key={step}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl border font-display text-sm font-extrabold ${tone}`}>{step}</div>
                <h4 className="font-display text-sm font-bold text-white">{title}</h4>
                <p className="text-xs leading-relaxed text-neutral-400">{text}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-4 text-xs text-neutral-400 sm:flex-row">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /><span>Chính sách hủy vé & hoàn tiền 100% trước giờ chiếu tối thiểu 60 phút.</span></div>
            <Link className="shrink-0 rounded-xl bg-amber-500 px-5 py-2.5 font-bold text-neutral-950 shadow-md shadow-amber-500/20 transition hover:bg-amber-400" href="/movies">Trải Nghiệm Đặt Vé Ngay →</Link>
          </div>
        </div>
      </section>

      {/* 9. HỆ THỐNG CỤM RẠP */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
        <div className="space-y-6 rounded-2xl border border-white/10 bg-neutral-900 p-6 sm:p-8">
          <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-xl font-bold text-white">Hệ Thống Rạp Moonlight Toàn Quốc</h2>
              <p className="mt-0.5 text-xs text-neutral-400">Không gian sang trọng, dịch vụ tận tâm và vị trí đắc địa tại các trung tâm thương mại lớn</p>
            </div>
            <Link className="self-start rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-950 shadow-sm transition hover:bg-amber-400 sm:self-auto" href="/cinemas">Khám Phá Cụm Rạp →</Link>
          </div>
          <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
            {branches.map((branch) => (
              <div className="space-y-1.5 rounded-xl border border-white/5 bg-neutral-950 p-4 transition hover:border-amber-500/20" key={branch.id}>
                <span className="block text-sm font-bold text-amber-400">{branch.name}</span>
                <p className="line-clamp-2 text-[11px] leading-relaxed text-neutral-400">{branch.address}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
