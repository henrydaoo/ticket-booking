'use client';

import { useState, useSyncExternalStore } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError } from '@/lib/api-client/client';
import { readSession, subscribeToSession } from '@/lib/auth/auth-boundary';
import { useBranchesQuery, useCinemaQuery, useCreateBranchMutation, useCreateCinemaMutation, useCreateMovieMutation, useMoviesQuery, useScreensQuery, useUpdateMovieMutation } from '@/lib/catalog/catalog-queries';
import { fmtDuration } from '@/lib/moonlight-format';
import { CompactPoster } from '@/features/movie-discovery/poster-card';
import { CreateScreenModal } from './create-screen-modal';
import { OPS_INPUT, OPS_LABEL, OpsModal, OpsTabs } from './ops-ui';

const PAGE_SIZE = 8;

const movieSchema = z.object({
  title: z.string().trim().min(1, 'Vui lòng nhập tên phim.'),
  durationMinutes: z.number().int().min(45).max(300),
  ageRating: z.string().min(1),
  status: z.enum(['COMING_SOON', 'NOW_SHOWING', 'ENDED']),
  genre: z.string().trim().min(1, 'Vui lòng nhập thể loại.'),
  posterUrl: z.string().url('Đường dẫn poster không hợp lệ.'),
  trailerUrl: z.string().url('Đường dẫn trailer không hợp lệ.'),
  description: z.string().trim().min(1, 'Vui lòng nhập tóm tắt nội dung.'),
});
const cinemaSchema = z.object({ name: z.string().trim().min(1, 'Vui lòng nhập tên cụm rạp.') });
const branchSchema = z.object({ cinemaId: z.string().min(1, 'Vui lòng chọn cụm rạp.'), name: z.string().trim().min(1, 'Vui lòng nhập tên chi nhánh.'), address: z.string().trim().min(1, 'Vui lòng nhập địa chỉ.') });

const errorText = (error: unknown) => (error instanceof ApiError ? error.message : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.');
const FieldError = ({ message }: { message?: string }) => (message ? <span className="text-rose-300">{message}</span> : null);
const Actions = ({ onCancel, pending, label }: { onCancel: () => void; pending: boolean; label: string }) => (
  <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
    <button className="rounded-xl bg-white/5 px-4 py-2.5 font-semibold text-neutral-300" onClick={onCancel} type="button">Hủy</button>
    <button className="rounded-xl bg-amber-500 px-5 py-2.5 font-bold text-neutral-950 hover:bg-amber-400 disabled:opacity-60" disabled={pending} type="submit">{pending ? 'Đang lưu...' : label}</button>
  </div>
);

export function AdminPage() {
  const session = useSyncExternalStore(subscribeToSession, readSession, () => null);
  const [tab, setTab] = useState<'movies' | 'branches'>('movies');
  const [modal, setModal] = useState<'movie' | 'branch' | 'cinema' | 'screen' | null>(null);
  const [page, setPage] = useState(1);
  const movies = useMoviesQuery().data ?? [];
  const cinemas = useCinemaQuery().data ?? [];
  const branches = useBranchesQuery().data ?? [];
  const screens = useScreensQuery().data ?? [];
  const movieMutation = useCreateMovieMutation();
  const updateMovie = useUpdateMovieMutation();
  const cinemaMutation = useCreateCinemaMutation();
  const branchMutation = useCreateBranchMutation();
  const movieForm = useForm<z.infer<typeof movieSchema>>({ resolver: zodResolver(movieSchema), defaultValues: { title: '', durationMinutes: 120, ageRating: 'T13', status: 'NOW_SHOWING', genre: '', posterUrl: '', trailerUrl: '', description: '' } });
  const cinemaForm = useForm<z.infer<typeof cinemaSchema>>({ resolver: zodResolver(cinemaSchema), defaultValues: { name: '' } });
  const branchForm = useForm<z.infer<typeof branchSchema>>({ resolver: zodResolver(branchSchema), defaultValues: { cinemaId: '', name: '', address: '' } });

  const totalPages = Math.max(1, Math.ceil(movies.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = movies.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const close = () => setModal(null);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <span className="rounded-md bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold uppercase text-emerald-400">Quản Trị Viên Hệ Thống Toàn Quốc</span>
          <h1 className="mt-1 font-display text-xl font-extrabold text-white sm:text-2xl">{session?.user.email}</h1>
          <p className="mt-0.5 text-xs text-neutral-400">Quản lý danh mục phim và mạng lưới cụm rạp toàn quốc</p>
        </div>
        <OpsTabs items={[
          { key: 'movies', icon: '🎬', label: 'Danh Mục Phim', short: 'Phim', active: tab === 'movies', onClick: () => setTab('movies') },
          { key: 'branches', icon: '🏛️', label: 'Cụm Rạp & Chi Nhánh', short: 'Rạp & Phòng', active: tab === 'branches', onClick: () => setTab('branches') },
        ]} />
      </div>

      {tab === 'movies' ? (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-xl font-bold text-white">Danh Mục Phim — Tạo Mới & Cập Nhật</h2>
              <p className="mt-0.5 text-xs text-neutral-400">Quản trị viên thêm phim mới, cập nhật độ tuổi và trạng thái phát hành toàn hệ thống</p>
            </div>
            <button className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-950 transition hover:bg-amber-400" onClick={() => setModal('movie')} type="button">+ Tạo Phim Mới</button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-900">
            <div className="divide-y divide-white/5 text-xs">
              {visible.map((movie) => (
                <div className="flex flex-col justify-between gap-3 p-3.5 sm:flex-row sm:items-center sm:px-5 sm:py-4" key={movie.id}>
                  <div className="flex min-w-0 items-center gap-3">
                    <CompactPoster movie={movie} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="shrink-0 rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white">{movie.ageRating}</span>
                        <h3 className="max-w-[200px] truncate font-display text-sm font-bold text-white sm:max-w-none sm:text-base">{movie.title}</h3>
                        <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${movie.status === 'NOW_SHOWING' ? 'bg-emerald-500/15 text-emerald-400' : movie.status === 'COMING_SOON' ? 'bg-amber-500/15 text-amber-400' : 'bg-neutral-800 text-neutral-400'}`}>{movie.status === 'NOW_SHOWING' ? 'ĐANG CHIẾU' : movie.status === 'COMING_SOON' ? 'SẮP CHIẾU' : 'ĐÃ DỪNG'}</span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-neutral-400 sm:text-xs">{fmtDuration(movie.durationMinutes)} · {movie.genre}</p>
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-end gap-2 border-t border-white/5 pt-2 sm:w-auto sm:border-t-0 sm:pt-0">
                    <select className="rounded-lg border border-white/10 bg-neutral-950 px-2.5 py-1.5 text-xs text-neutral-300" disabled={updateMovie.isPending} onChange={(event) => void updateMovie.mutateAsync({ id: movie.id, input: { status: event.target.value as typeof movie.status } })} value={movie.status}>
                      <option value="NOW_SHOWING">Đang chiếu</option>
                      <option value="COMING_SOON">Sắp chiếu</option>
                      <option value="ENDED">Dừng chiếu</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {updateMovie.error ? <p className="text-xs text-rose-300" role="alert">{errorText(updateMovie.error)}</p> : null}
          {totalPages > 1 ? (
            <div className="mt-8 flex items-center justify-center gap-2">
              <button className="page-btn" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} type="button">← Trước</button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((item) => <button className={`page-btn ${item === currentPage ? 'active' : ''}`} key={item} onClick={() => setPage(item)} type="button">{item}</button>)}
              <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} type="button">Sau →</button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-xl font-bold text-white">Quản Lý Cụm Rạp, Chi Nhánh & Phòng Chiếu Toàn Quốc</h2>
              <p className="mt-0.5 text-xs text-neutral-400">Quản trị viên mở thêm cụm rạp, chi nhánh và tạo phòng chiếu toàn hệ thống</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15" onClick={() => setModal('cinema')} type="button">+ Thêm Cụm Rạp</button>
              <button className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15" onClick={() => setModal('branch')} type="button">+ Thêm Chi Nhánh</button>
              <button className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400" onClick={() => setModal('screen')} type="button">+ Tạo Phòng Chiếu Mới</button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {branches.map((branch) => {
              const own = screens.filter((screen) => screen.branchId === branch.id);
              return (
                <div className="space-y-4 rounded-2xl border border-white/10 bg-neutral-900 p-5" key={branch.id}>
                  <div>
                    <span className="text-xs font-semibold text-amber-400">{cinemas.find((cinema) => cinema.id === branch.cinemaId)?.name}</span>
                    <h3 className="mt-0.5 font-display text-lg font-bold text-white">{branch.name}</h3>
                    <p className="mt-0.5 text-xs text-neutral-400">{branch.address}</p>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <span className="block font-medium text-neutral-400">Phòng chiếu ({own.length})</span>
                    {own.length === 0 ? <p className="italic text-neutral-500">Chưa có phòng chiếu.</p> : own.map((screen) => <div className="flex items-center justify-between rounded-lg border border-white/5 bg-neutral-950 px-3 py-2" key={screen.id}><strong className="text-white">{screen.name}</strong><span className="text-neutral-400">{screen.capacity} ghế</span></div>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modal === 'screen' ? <CreateScreenModal branches={branches} onClose={close} /> : null}

      {modal === 'movie' ? (
        <OpsModal eyebrow="Danh mục phim" onClose={close} title="Tạo Phim Mới Vào Hệ Thống">
          <form className="mt-5 space-y-4 text-xs" onSubmit={movieForm.handleSubmit(async (values) => { await movieMutation.mutateAsync(values).then(() => { movieForm.reset(); close(); }).catch(() => undefined); })}>
            <div><label className={OPS_LABEL}>Tên phim</label><input className={OPS_INPUT} placeholder="Tên phim chiếu rạp..." type="text" {...movieForm.register('title')} /><FieldError message={movieForm.formState.errors.title?.message} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div><label className={OPS_LABEL}>Thời lượng (phút)</label><input className={OPS_INPUT} type="number" {...movieForm.register('durationMinutes', { valueAsNumber: true })} /></div>
              <div><label className={OPS_LABEL}>Phân loại độ tuổi</label><select className={OPS_INPUT} {...movieForm.register('ageRating')}><option value="P">P (Mọi lứa tuổi)</option><option value="T13">T13 (Từ 13 tuổi)</option><option value="T16">T16 (Từ 16 tuổi)</option><option value="T18">T18 (Từ 18 tuổi)</option></select></div>
              <div><label className={OPS_LABEL}>Trạng thái phát hành</label><select className={OPS_INPUT} {...movieForm.register('status')}><option value="NOW_SHOWING">Đang Chiếu</option><option value="COMING_SOON">Sắp Chiếu</option><option value="ENDED">Đã Dừng Chiếu</option></select></div>
            </div>
            <div><label className={OPS_LABEL}>Thể loại</label><input className={OPS_INPUT} placeholder="Khoa học viễn tưởng, Hành động" type="text" {...movieForm.register('genre')} /><FieldError message={movieForm.formState.errors.genre?.message} /></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><label className={OPS_LABEL}>Đường dẫn poster</label><input className={OPS_INPUT} placeholder="https://..." type="url" {...movieForm.register('posterUrl')} /><FieldError message={movieForm.formState.errors.posterUrl?.message} /></div>
              <div><label className={OPS_LABEL}>Đường dẫn trailer</label><input className={OPS_INPUT} placeholder="https://..." type="url" {...movieForm.register('trailerUrl')} /><FieldError message={movieForm.formState.errors.trailerUrl?.message} /></div>
            </div>
            <div><label className={OPS_LABEL}>Tóm tắt nội dung</label><textarea className="w-full rounded-xl border border-white/10 bg-neutral-950 p-3 text-white focus:border-amber-400 focus:outline-none" placeholder="Tóm tắt ngắn nội dung phim..." rows={3} {...movieForm.register('description')} /><FieldError message={movieForm.formState.errors.description?.message} /></div>
            {movieMutation.error ? <div className="rounded-xl border border-rose-500/40 bg-rose-950/80 p-3 text-rose-200" role="alert">{errorText(movieMutation.error)}</div> : null}
            <Actions label="Lưu & Tạo Phim" onCancel={close} pending={movieMutation.isPending} />
          </form>
        </OpsModal>
      ) : null}

      {modal === 'cinema' ? (
        <OpsModal eyebrow="Mạng lưới rạp" onClose={close} title="Thêm Cụm Rạp Mới">
          <form className="mt-5 space-y-4 text-xs" onSubmit={cinemaForm.handleSubmit(async (values) => { await cinemaMutation.mutateAsync(values).then(() => { cinemaForm.reset(); close(); }).catch(() => undefined); })}>
            <div><label className={OPS_LABEL}>Tên cụm rạp</label><input className={OPS_INPUT} placeholder="Moonlight Cinema Vietnam" type="text" {...cinemaForm.register('name')} /><FieldError message={cinemaForm.formState.errors.name?.message} /></div>
            {cinemaMutation.error ? <div className="rounded-xl border border-rose-500/40 bg-rose-950/80 p-3 text-rose-200" role="alert">{errorText(cinemaMutation.error)}</div> : null}
            <Actions label="Lưu Cụm Rạp" onCancel={close} pending={cinemaMutation.isPending} />
          </form>
        </OpsModal>
      ) : null}

      {modal === 'branch' ? (
        <OpsModal eyebrow="Mạng lưới rạp" onClose={close} title="Thêm Chi Nhánh Mới">
          <form className="mt-5 space-y-4 text-xs" onSubmit={branchForm.handleSubmit(async (values) => { await branchMutation.mutateAsync(values).then(() => { branchForm.reset(); close(); }).catch(() => undefined); })}>
            <div><label className={OPS_LABEL}>Cụm rạp</label><select className={OPS_INPUT} {...branchForm.register('cinemaId')}><option value="">Chọn cụm rạp</option>{cinemas.map((cinema) => <option key={cinema.id} value={cinema.id}>{cinema.name}</option>)}</select><FieldError message={branchForm.formState.errors.cinemaId?.message} /></div>
            <div><label className={OPS_LABEL}>Tên chi nhánh</label><input className={OPS_INPUT} placeholder="Moonlight Landmark 81" type="text" {...branchForm.register('name')} /><FieldError message={branchForm.formState.errors.name?.message} /></div>
            <div><label className={OPS_LABEL}>Địa chỉ</label><input className={OPS_INPUT} placeholder="720A Điện Biên Phủ, Bình Thạnh" type="text" {...branchForm.register('address')} /><FieldError message={branchForm.formState.errors.address?.message} /></div>
            {branchMutation.error ? <div className="rounded-xl border border-rose-500/40 bg-rose-950/80 p-3 text-rose-200" role="alert">{errorText(branchMutation.error)}</div> : null}
            <Actions label="Lưu Chi Nhánh" onCancel={close} pending={branchMutation.isPending} />
          </form>
        </OpsModal>
      ) : null}
    </div>
  );
}
