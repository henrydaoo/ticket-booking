'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSyncExternalStore } from 'react';
import { ApiError } from '@/lib/api-client/client';
import { readSession, subscribeToSession } from '@/lib/auth/auth-boundary';
import { useBranchesQuery, useCreateShowtimeMutation, useMoviesQuery, usePublishShowtimeMutation, useScreensQuery, useShowtimesQuery } from '@/lib/catalog/catalog-queries';
import { buildDates, dayRange, fmtDuration, fmtTime } from '@/lib/moonlight-format';
import { CreateScreenModal } from './create-screen-modal';
import { OPS_INPUT, OPS_LABEL, OpsModal, OpsTabs } from './ops-ui';
import { CheckInPage } from '@/features/check-in/check-in-page';

const showtimeSchema = z.object({
  movieId: z.string().min(1, 'Vui lòng chọn phim.'),
  screenId: z.string().min(1, 'Vui lòng chọn phòng chiếu.'),
  date: z.string().min(1),
  time: z.string().min(1, 'Vui lòng chọn giờ bắt đầu.'),
});
type ShowtimeValues = z.infer<typeof showtimeSchema>;

export function ManagerPage({ view = 'showtimes' }: { view?: 'showtimes' | 'screens' | 'check-in' }) {
  const session = useSyncExternalStore(subscribeToSession, readSession, () => null);
  const dates = useMemo(() => buildDates(), []);
  const [date, setDate] = useState(dates[0].value);
  const [modal, setModal] = useState<'showtime' | 'screen' | null>(null);
  const [formError, setFormError] = useState('');
  const branches = useBranchesQuery().data ?? [];
  const movies = useMoviesQuery().data ?? [];
  const screens = useScreensQuery().data ?? [];
  const showtimes = useShowtimesQuery(dayRange(date));
  const allShowtimes = useShowtimesQuery().data ?? [];
  const createShowtime = useCreateShowtimeMutation();
  const publish = usePublishShowtimeMutation();
  const nowShowing = movies.filter((movie) => movie.status === 'NOW_SHOWING');
  const form = useForm<ShowtimeValues>({ resolver: zodResolver(showtimeSchema), defaultValues: { movieId: '', screenId: '', date: dates[0].value, time: '14:00' } });

  const list = [...(showtimes.data ?? [])].sort((a, b) => a.startAt.localeCompare(b.startAt));

  const submit = form.handleSubmit(async (values) => {
    setFormError('');
    const movie = movies.find((item) => item.id === values.movieId);
    if (!movie) return;
    const start = new Date(`${values.date}T${values.time}:00`);
    const end = new Date(start.getTime() + movie.durationMinutes * 60000);
    try {
      await createShowtime.mutateAsync({ movieId: values.movieId, screenId: values.screenId, startAt: start.toISOString(), endAt: end.toISOString() });
      setModal(null);
      form.reset();
    } catch (caught) {
      setFormError(caught instanceof ApiError ? caught.message : 'Không thể tạo suất chiếu. Vui lòng thử lại.');
    }
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <span className="rounded-md bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold uppercase text-amber-400">Cổng Quản Lý Cụm Rạp</span>
          <h1 className="mt-1 font-display text-xl font-extrabold text-white sm:text-2xl">{session?.user.email}</h1>
          <p className="mt-0.5 text-xs text-neutral-400">Phụ trách: {branches.map((branch) => branch.name).join(' · ')}</p>
        </div>
        <OpsTabs items={[
          { key: 'showtimes', icon: '📅', label: 'Lập Lịch Suất Chiếu', short: 'Suất chiếu', active: view === 'showtimes', href: '/staff/showtimes' },
          { key: 'screens', icon: '💺', label: 'Phòng Chiếu & Ghế', short: 'Sơ đồ ghế', active: view === 'screens', href: '/staff/screens' },
          { key: 'check-in', icon: '🎟️', label: 'Soát Vé & Đảo Check-in', short: 'Soát vé', active: view === 'check-in', href: '/staff/check-in' },
        ]} />
      </div>

      {view === 'check-in' ? <CheckInPage /> : view === 'showtimes' ? (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-xl font-bold text-white">Lập Lịch Suất Chiếu & Kiểm Tra Đệm 30 Phút</h2>
              <p className="mt-0.5 text-xs text-neutral-400">Hệ thống tự động từ chối trùng lịch và bắt buộc có 30 phút dọn phòng giữa các suất</p>
            </div>
            <div className="flex items-center gap-2.5">
              <select className="rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-xs text-white" onChange={(event) => setDate(event.target.value)} value={date}>{dates.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.value})</option>)}</select>
              <button className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-950 transition hover:bg-amber-400" onClick={() => { form.setValue('date', date); setModal('showtime'); }} type="button">+ Lập Suất Chiếu Mới</button>
            </div>
          </div>
          <div className="space-y-3">
            {showtimes.isPending ? <div className="rounded-2xl bg-neutral-900 p-8 text-center text-xs text-neutral-400">Đang tải lịch chiếu...</div> : null}
            {!showtimes.isPending && list.length === 0 ? <div className="rounded-2xl border border-white/10 bg-neutral-900 p-8 text-center text-xs text-neutral-400">Chưa có suất chiếu nào trong ngày này.</div> : null}
            {list.map((item) => {
              const movie = movies.find((entry) => entry.id === item.movieId);
              const branch = branches.find((entry) => entry.id === item.branchId);
              const screen = screens.find((entry) => entry.id === item.screenId);
              return (
                <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-neutral-900 p-4 sm:flex-row sm:items-center" key={item.id}>
                  <div className="flex items-center gap-4">
                    <div className="shrink-0 rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2 text-center">
                      <span className="block font-display text-sm font-bold tabular-nums text-amber-400">{fmtTime(item.startAt)}</span>
                      <span className="block text-[10px] tabular-nums text-neutral-500">đến {fmtTime(item.endAt)}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-bold text-white">{movie?.title ?? 'Phim'}</h3>
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${item.status === 'PUBLISHED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{item.status === 'PUBLISHED' ? 'ĐÃ XUẤT BẢN' : 'BẢN NHÁP'}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-400">{branch?.name} · {screen?.name} · Sức chứa: {screen?.capacity ?? 0} ghế{movie ? ` · ${fmtDuration(movie.durationMinutes)}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {item.status === 'DRAFT' ? <button className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-neutral-950 hover:bg-emerald-400 disabled:opacity-60" disabled={publish.isPending} onClick={() => void publish.mutateAsync({ id: item.id })} type="button">Xuất bản</button> : null}
                  </div>
                </div>
              );
            })}
          </div>
          {publish.error ? <p className="text-xs text-rose-300" role="alert">{publish.error instanceof ApiError ? publish.error.message : 'Không thể xuất bản suất chiếu.'}</p> : null}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display text-xl font-bold text-white">Quản Lý Phòng Chiếu & Trình Seed Sơ Đồ Ghế</h2>
              <p className="mt-0.5 text-xs text-neutral-400">Tạo phòng chiếu mới, tự động sinh dữ liệu ghế và cấu hình giá vé theo hạng ghế</p>
            </div>
            <button className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-950 transition hover:bg-amber-400" onClick={() => setModal('screen')} type="button">+ Tạo Phòng Chiếu Mới</button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {screens.map((screen) => {
              const branch = branches.find((item) => item.id === screen.branchId);
              const locked = allShowtimes.some((item) => item.screenId === screen.id && item.status === 'PUBLISHED');
              return (
                <div className="space-y-4 rounded-2xl border border-white/10 bg-neutral-900 p-5" key={screen.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400">{branch?.name}</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${locked ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-400'}`}>{locked ? '🔒 Đã Khóa Sơ Đồ (Có suất chiếu)' : '🔓 Khả Dụng Để Cấu Hình'}</span>
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-white">{screen.name}</h3>
                    <p className="mt-0.5 text-xs text-neutral-400">Sức chứa: {screen.capacity} ghế · Phiên bản sơ đồ: v{screen.layoutVersion}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modal === 'screen' ? <CreateScreenModal branches={branches} onClose={() => setModal(null)} /> : null}
      {modal === 'showtime' ? (
        <OpsModal eyebrow="Lập lịch suất chiếu" onClose={() => setModal(null)} title="Tạo Suất Chiếu Mới (Đệm 30 Phút)">
          <form className="mt-5 space-y-4 text-xs" onSubmit={submit}>
            <div>
              <label className={OPS_LABEL}>Phim (Chỉ phim đang chiếu)</label>
              <select className={OPS_INPUT} {...form.register('movieId')}><option value="">Chọn phim</option>{nowShowing.map((movie) => <option key={movie.id} value={movie.id}>{movie.title} ({fmtDuration(movie.durationMinutes)})</option>)}</select>
              {form.formState.errors.movieId ? <span className="text-rose-300">{form.formState.errors.movieId.message}</span> : null}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={OPS_LABEL}>Phòng chiếu</label>
                <select className={OPS_INPUT} {...form.register('screenId')}><option value="">Chọn phòng chiếu</option>{screens.map((screen) => <option key={screen.id} value={screen.id}>{branches.find((branch) => branch.id === screen.branchId)?.name} — {screen.name}</option>)}</select>
                {form.formState.errors.screenId ? <span className="text-rose-300">{form.formState.errors.screenId.message}</span> : null}
              </div>
              <div>
                <label className={OPS_LABEL}>Ngày chiếu</label>
                <select className={OPS_INPUT} {...form.register('date')}>{dates.map((item) => <option key={item.value} value={item.value}>{item.label} ({item.value})</option>)}</select>
              </div>
            </div>
            <div>
              <label className={OPS_LABEL}>Giờ bắt đầu</label>
              <input className={`${OPS_INPUT} tabular-nums`} type="time" {...form.register('time')} />
            </div>
            {formError ? <div className="rounded-xl border border-rose-500/40 bg-rose-950/80 p-3 text-rose-200" role="alert">{formError}</div> : null}
            <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
              <button className="rounded-xl bg-white/5 px-4 py-2.5 font-semibold text-neutral-300" onClick={() => setModal(null)} type="button">Hủy</button>
              <button className="rounded-xl bg-amber-500 px-5 py-2.5 font-bold text-neutral-950 hover:bg-amber-400 disabled:opacity-60" disabled={createShowtime.isPending} type="submit">{createShowtime.isPending ? 'Đang tạo...' : 'Tạo Suất Chiếu (Bản Nháp)'}</button>
            </div>
          </form>
        </OpsModal>
      ) : null}
    </div>
  );
}
