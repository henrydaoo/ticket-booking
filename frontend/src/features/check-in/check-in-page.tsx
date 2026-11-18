'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError, userFacingApiError } from '@/lib/api-client/client';
import { readSession, subscribeToSession } from '@/lib/auth/auth-boundary';
import { useCheckInMutation, useReverseCheckInMutation } from '@/lib/tickets/check-in-queries';
import type { CheckInResponse } from '@/lib/tickets/check-in-client';
import { useSyncExternalStore } from 'react';

const checkInSchema = z.object({
  qrToken: z.string().trim().min(1, 'Vui lòng quét hoặc nhập mã QR.'),
  showtimeId: z.string().trim().min(1, 'Vui lòng nhập mã suất chiếu.'),
  branchId: z.string().trim().min(1, 'Vui lòng chọn chi nhánh.'),
});

const reversalSchema = z.object({
  reason: z.string().trim().min(1, 'Vui lòng nhập lý do đảo check-in.').max(500, 'Lý do không được vượt quá 500 ký tự.'),
});

type CheckInValues = z.infer<typeof checkInSchema>;
type ReversalValues = z.infer<typeof reversalSchema>;

function messageForError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  switch (error.code ?? error.message) {
    case 'TICKET_BRANCH_FORBIDDEN':
    case 'BRANCH_CONTEXT_FORBIDDEN':
      return 'Bạn không được phép soát vé tại chi nhánh này.';
    case 'TICKET_SHOWTIME_MISMATCH':
      return 'Vé không thuộc suất chiếu đã nhập.';
    case 'TICKET_USED':
      return 'Vé này đã được sử dụng trước đó.';
    case 'TICKET_CANCELLED':
      return 'Vé này đã bị hủy và không thể sử dụng.';
    case 'CHECK_IN_REVERSAL_ROLE_REQUIRED':
      return 'Chỉ quản lý rạp hoặc quản trị viên mới được đảo check-in.';
    case 'PLATFORM_ADMIN_MFA_REQUIRED':
      return 'Quản trị viên phải hoàn tất MFA trước thao tác này.';
    case 'CHECK_IN_ALREADY_REVERSED':
      return 'Check-in này đã được đảo trước đó.';
    case 'CHECK_IN_NOT_FOUND':
      return 'Không tìm thấy bản ghi check-in.';
    default:
      return userFacingApiError(error, error.status >= 500 ? 'Dịch vụ soát vé đang tạm thời không khả dụng.' : fallback);
  }
}

export function CheckInPage() {
  const session = useSyncExternalStore(subscribeToSession, readSession, () => null);
  const branchIds = session?.user.branchIds ?? [];
  const roles = session?.user.roles ?? [];
  const canReverse = roles.includes('CINEMA_MANAGER') || roles.includes('PLATFORM_ADMIN');
  const checkIn = useCheckInMutation();
  const reverse = useReverseCheckInMutation();
  const [result, setResult] = useState<CheckInResponse | null>(null);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const qrInputRef = useRef<HTMLInputElement | null>(null);
  const checkInForm = useForm<CheckInValues>({
    resolver: zodResolver(checkInSchema),
    defaultValues: { qrToken: '', showtimeId: '', branchId: branchIds[0] ?? '' },
  });
  const qrTokenField = checkInForm.register('qrToken');
  const reversalForm = useForm<ReversalValues>({ resolver: zodResolver(reversalSchema), defaultValues: { reason: '' } });
  const selectedBranch = checkInForm.watch('branchId');
  const hasBranches = branchIds.length > 0;
  const branchOptions = useMemo(() => branchIds.map((branchId) => ({ id: branchId, label: branchId })), [branchIds]);

  useEffect(() => {
    if (!selectedBranch && branchIds[0]) checkInForm.setValue('branchId', branchIds[0]);
  }, [branchIds, checkInForm, selectedBranch]);

  const submitCheckIn = checkInForm.handleSubmit(async (values) => {
    setFormError('');
    setSuccessMessage('');
    setResult(null);
    try {
      const response = await checkIn.mutateAsync(values);
      setResult(response);
      setSuccessMessage('Vé đã được xác nhận vào rạp.');
      checkInForm.setValue('qrToken', '');
      reversalForm.reset();
      qrInputRef.current?.focus();
    } catch (error) {
      setFormError(messageForError(error, 'Không thể xác nhận vé. Kiểm tra lại thông tin và thử lại.'));
    }
  });

  const submitReversal = reversalForm.handleSubmit(async ({ reason }) => {
    if (!result) return;
    setFormError('');
    setSuccessMessage('');
    try {
      await reverse.mutateAsync({ checkInId: result.checkInId, reason, branchId: result.branchId });
      setResult(null);
      reversalForm.reset();
      setSuccessMessage('Check-in đã được đảo thành công. Vé trở lại trạng thái còn hiệu lực.');
    } catch (error) {
      setFormError(messageForError(error, 'Không thể đảo check-in. Vui lòng kiểm tra quyền và thử lại.'));
    }
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="border-b border-white/10 pb-6">
        <span className="rounded-md bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold uppercase text-amber-400">Cổng Soát Vé</span>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-white">Check-in vé QR</h1>
        <p className="mt-1 text-sm text-neutral-400">Xác nhận vé tại đúng suất chiếu và chi nhánh được phân quyền.</p>
      </header>

      {!hasBranches ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200" role="alert">
          Tài khoản chưa được gán chi nhánh. Hãy liên hệ quản trị viên trước khi soát vé.
        </div>
      ) : (
        <form className="space-y-5 rounded-2xl border border-white/10 bg-neutral-900 p-6" onSubmit={submitCheckIn}>
          <div>
            <h2 className="font-display text-base font-bold text-white">Quét hoặc nhập thông tin vé</h2>
            <p className="mt-1 text-xs text-neutral-400">Thiết bị quét QR có thể nhập token trực tiếp vào ô đầu tiên.</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-neutral-300" htmlFor="qr-token">Mã QR vé</label>
            <input {...qrTokenField} autoComplete="off" className="w-full rounded-xl border border-white/15 bg-neutral-950 px-4 py-3 font-mono text-sm text-white outline-none focus:border-amber-400" id="qr-token" ref={(element) => { qrTokenField.ref(element); qrInputRef.current = element; }} placeholder="Dán token QR tại đây" />
            {checkInForm.formState.errors.qrToken ? <p className="text-xs text-rose-300">{checkInForm.formState.errors.qrToken.message}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-300" htmlFor="showtime-id">Mã suất chiếu</label>
              <input {...checkInForm.register('showtimeId')} className="w-full rounded-xl border border-white/15 bg-neutral-950 px-4 py-3 font-mono text-sm text-white outline-none focus:border-amber-400" id="showtime-id" placeholder="showtime ID" />
              {checkInForm.formState.errors.showtimeId ? <p className="text-xs text-rose-300">{checkInForm.formState.errors.showtimeId.message}</p> : null}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-300" htmlFor="branch-id">Chi nhánh hiện tại</label>
              <select {...checkInForm.register('branchId')} className="w-full rounded-xl border border-white/15 bg-neutral-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-400" id="branch-id">
                {branchOptions.map((branch) => <option key={branch.id} value={branch.id}>{branch.label}</option>)}
              </select>
              {checkInForm.formState.errors.branchId ? <p className="text-xs text-rose-300">{checkInForm.formState.errors.branchId.message}</p> : null}
            </div>
          </div>
          {formError ? <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200" role="alert">{formError}</div> : null}
          {successMessage ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200" role="status" aria-live="polite">{successMessage}</div> : null}
          <button className="w-full rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-neutral-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60" disabled={checkIn.isPending} type="submit">
            {checkIn.isPending ? 'Đang xác thực...' : 'Xác nhận check-in'}
          </button>
        </form>
      )}

      {result ? (
        <section aria-labelledby="check-in-result-title" className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
          <div>
            <h2 className="font-display text-base font-bold text-emerald-100" id="check-in-result-title">Check-in thành công</h2>
            <p className="mt-1 text-xs text-emerald-200/80">Vé {result.ticketId} đã chuyển sang trạng thái ĐÃ SỬ DỤNG.</p>
          </div>
          {canReverse ? (
            <form className="space-y-3 border-t border-emerald-500/20 pt-4" onSubmit={submitReversal}>
              <label className="text-xs font-semibold text-emerald-100" htmlFor="reversal-reason">Lý do đảo check-in</label>
              <textarea {...reversalForm.register('reason')} className="min-h-24 w-full rounded-xl border border-emerald-500/20 bg-neutral-950 px-4 py-3 text-sm text-white outline-none focus:border-amber-400" id="reversal-reason" placeholder="Nhập lý do vận hành bắt buộc" />
              {reversalForm.formState.errors.reason ? <p className="text-xs text-rose-300">{reversalForm.formState.errors.reason.message}</p> : null}
              <button className="rounded-xl border border-amber-400/40 bg-amber-400/15 px-4 py-2.5 text-xs font-bold text-amber-200 hover:bg-amber-400/25 disabled:opacity-60" disabled={reverse.isPending} type="submit">
                {reverse.isPending ? 'Đang đảo check-in...' : 'Đảo check-in'}
              </button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
