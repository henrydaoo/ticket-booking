'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError } from '@/lib/api-client/client';
import {
  confirmPasswordReset,
  login,
  register,
  requestPasswordReset,
  verifyEmail,
} from '@/lib/auth/auth-client';
import type { AuthSession } from '@/lib/auth/auth-boundary';

const authFormSchema = z.object({
  email: z.string().trim().email('Vui lòng nhập địa chỉ email hợp lệ.').or(z.literal('')),
  password: z.string().min(8, 'Mật khẩu phải có tối thiểu 8 ký tự.').or(z.literal('')),
  mfaCode: z.string().regex(/^\d{6}$/, 'Mã xác thực gồm 6 chữ số.').or(z.literal('')),
  token: z.string(),
});

type AuthFormValues = z.infer<typeof authFormSchema>;
type AuthMode = 'login' | 'register' | 'verify' | 'reset';

function safeError(error: unknown): string {
  if (error instanceof ApiError && error.status < 500) return error.message;
  return 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
}

function sessionDestination(session: AuthSession): string {
  const roles = session.user.roles;
  if (roles.includes('PLATFORM_ADMIN') && session.user.mfaCompleted) return '/admin';
  if (roles.includes('CINEMA_MANAGER') || roles.includes('CINEMA_STAFF')) return '/staff';
  return '/';
}

function schemaForMode(mode: AuthMode) {
  return authFormSchema.superRefine((values, context) => {
    if (mode !== 'verify' && !values.email && !(mode === 'reset' && values.token)) {
      context.addIssue({ code: 'custom', path: ['email'], message: 'Vui lòng nhập địa chỉ email.' });
    }
    if (mode === 'login' || mode === 'register' || (mode === 'reset' && values.token)) {
      if (!values.password) {
        context.addIssue({ code: 'custom', path: ['password'], message: 'Vui lòng nhập mật khẩu.' });
      }
    }
    if (mode === 'verify' || (mode === 'reset' && values.password && !values.token)) {
      context.addIssue({ code: 'custom', path: ['token'], message: 'Thiếu mã xác thực trong liên kết.' });
    }
  });
}

const INPUT = 'w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-white focus:border-amber-400 focus:outline-none';
const SUBMIT = 'w-full rounded-xl bg-amber-500 py-3.5 text-sm font-bold text-neutral-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60';

const ROLE_CARDS = [
  { key: 'CUSTOMER', title: '👤 Khách Hàng', tag: 'Đặt vé', sub: 'Xem phim & vé QR', hover: 'hover:border-amber-500/40', color: 'text-amber-400' },
  { key: 'CINEMA_STAFF', title: '🎫 Soát Vé QR', tag: 'Tại rạp', sub: 'Cửa phòng chiếu', hover: 'hover:border-sky-500/40', color: 'text-sky-400' },
  { key: 'CINEMA_MANAGER', title: '👔 Quản Lý Rạp', tag: 'Cụm rạp', sub: 'Suất, sơ đồ & sự cố', hover: 'hover:border-emerald-500/40', color: 'text-emerald-400' },
  { key: 'PLATFORM_ADMIN', title: '⚡ Quản Trị Viên', tag: 'Toàn quốc', sub: 'Phim, chi nhánh, audit', hover: 'hover:border-purple-500/40', color: 'text-purple-400' },
] as const;

export function AuthForm({ mode, requireMfa = false }: { mode: AuthMode; requireMfa?: boolean }) {
  const router = useRouter();
  const [successMessage, setSuccessMessage] = useState('');
  const [mfaRequired, setMfaRequired] = useState(requireMfa);
  const [roleHint, setRoleHint] = useState<(typeof ROLE_CARDS)[number]['key']>(requireMfa ? 'PLATFORM_ADMIN' : 'CUSTOMER');
  const form = useForm<AuthFormValues>({
    resolver: zodResolver(schemaForMode(mode)),
    defaultValues: { email: '', password: '', mfaCode: '', token: '' },
  });
  const mutation = useMutation({
    mutationFn: async (values: AuthFormValues) => {
      if (mode === 'login') return { session: await login(values.email, values.password, values.mfaCode || undefined) };
      if (mode === 'register') return { result: await register(values.email, values.password) };
      if (mode === 'verify') return { result: await verifyEmail(values.token) };
      if (values.token) return { result: await confirmPasswordReset(values.token, values.password) };
      return { result: await requestPasswordReset(values.email) };
    },
    onSuccess: (result) => {
      if ('session' in result && result.session) {
        router.replace(sessionDestination(result.session));
        router.refresh();
        return;
      }
      setSuccessMessage(mode === 'register'
        ? 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.'
        : mode === 'verify'
          ? 'Email đã được xác thực. Bạn có thể đăng nhập ngay.'
          : 'Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi đến email.');
      form.reset({ email: '', password: '', mfaCode: '', token: '' });
    },
    onError: (error) => {
      if (mode === 'login' && error instanceof ApiError && error.status === 401 && error.message.toLowerCase().includes('mfa')) {
        setMfaRequired(true);
      }
      form.setError('root.server', { message: safeError(error) });
    },
  });

  const verificationStarted = useRef(false);
  useEffect(() => {
    const tokenFromUrl = new URLSearchParams(window.location.search).get('token') ?? '';
    if (mode === 'verify') {
      if (!tokenFromUrl) {
        form.setError('root.server', { message: 'Liên kết xác thực thiếu mã. Vui lòng yêu cầu liên kết mới hoặc đăng nhập.' });
        return;
      }
      if (!verificationStarted.current) {
        verificationStarted.current = true;
        mutation.mutate({ email: '', password: '', mfaCode: '', token: tokenFromUrl });
      }
      return;
    }
    if (mode === 'reset') form.setValue('token', tokenFromUrl);
  }, [form, mode, mutation]);

  function submit(event: FormEvent<HTMLFormElement>) {
    void form.handleSubmit((values) => {
      setSuccessMessage('');
      form.clearErrors('root.server');
      mutation.mutate(values);
    })(event);
  }

  const email = form.register('email');
  const password = form.register('password');
  const mfaCode = form.register('mfaCode');
  const tokenValue = form.watch('token');
  const fieldError = (name: keyof AuthFormValues) => form.formState.errors[name]?.message;
  const showTabs = mode === 'login' || mode === 'register';

  return (
    <>
      <div className="space-y-6">
        {showTabs ? (
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <Link className={`rounded-xl px-4 py-2 text-xs transition ${mode === 'login' ? 'bg-amber-500 font-bold text-neutral-950 shadow-md shadow-amber-500/20' : 'bg-white/5 font-semibold text-neutral-300 hover:bg-white/10 hover:text-white'}`} href="/login">🔑 Đăng Nhập</Link>
              <Link className={`rounded-xl px-4 py-2 text-xs transition ${mode === 'register' ? 'bg-amber-500 font-bold text-neutral-950 shadow-md shadow-amber-500/20' : 'bg-white/5 font-semibold text-neutral-300 hover:bg-white/10 hover:text-white'}`} href="/register">✨ Đăng Ký Mới</Link>
            </div>
            <span className="hidden text-xs text-neutral-400 sm:inline">{mode === 'register' ? 'Khách hàng mới' : requireMfa ? 'Quản trị viên' : 'Khách hàng thành viên'}</span>
          </div>
        ) : (
          <div className="border-b border-white/10 pb-4">
            <h1 className="font-display text-xl font-extrabold text-white">{mode === 'verify' ? 'Xác Thực Email' : 'Đặt Lại Mật Khẩu'}</h1>
          </div>
        )}

        <form className="space-y-4 text-xs" noValidate onSubmit={submit}>
          {mode !== 'verify' && (mode !== 'reset' || !tokenValue) ? (
            <div>
              <label className="mb-1.5 block font-semibold text-neutral-300">Địa chỉ Email</label>
              <input {...email} autoComplete="email" className={INPUT} placeholder="khachhang@example.com" type="email" />
              {fieldError('email') ? <span className="mt-1 block text-xs text-rose-300">{fieldError('email')}</span> : null}
            </div>
          ) : null}
          {mode === 'verify' ? <p aria-live="polite" className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 text-xs leading-6 text-neutral-400" role="status">{mutation.isPending ? 'Đang kiểm tra liên kết xác thực...' : successMessage || 'Liên kết xác thực của bạn đang được kiểm tra.'}</p> : null}
          {mode !== 'verify' && (mode !== 'reset' || Boolean(tokenValue)) ? (
            <div>
              <div className="mb-1.5 flex justify-between">
                <label className="font-semibold text-neutral-300">{mode === 'register' ? 'Mật khẩu (tối thiểu 8 ký tự)' : 'Mật khẩu'}</label>
                {mode === 'login' ? <Link className="text-amber-400 hover:underline" href="/reset-password">Quên mật khẩu?</Link> : null}
              </div>
              <input {...password} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={INPUT} placeholder="••••••••" type="password" />
              {fieldError('password') ? <span className="mt-1 block text-xs text-rose-300">{fieldError('password')}</span> : null}
            </div>
          ) : null}
          {mode === 'login' && mfaRequired ? (
            <div>
              <label className="mb-1.5 block font-semibold text-neutral-300">Mã xác thực quản trị (6 chữ số)</label>
              <input {...mfaCode} autoComplete="one-time-code" className={INPUT} inputMode="numeric" maxLength={6} placeholder="••••••" />
              {fieldError('mfaCode') ? <span className="mt-1 block text-xs text-rose-300">{fieldError('mfaCode')}</span> : null}
            </div>
          ) : null}
          {mode !== 'verify' ? <button className={SUBMIT} disabled={mutation.isPending} type="submit">{mutation.isPending ? 'Đang xử lý...' : mode === 'login' ? 'Đăng Nhập Vào Hệ Thống →' : mode === 'register' ? 'Hoàn Tất Đăng Ký Tài Khoản →' : tokenValue ? 'Đặt Lại Mật Khẩu →' : 'Gửi Liên Kết Đặt Lại →'}</button> : null}
          {successMessage && mode !== 'verify' ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300" role="status">{successMessage}</p> : null}
          {form.formState.errors.root?.server ? <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300" role="alert">{form.formState.errors.root.server.message}</p> : null}
        </form>
      </div>

      {mode === 'login' ? (
        <div className="space-y-2.5 border-t border-white/10 pt-6">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Đăng Nhập Theo Vai Trò</span>
            <span className="text-[10px] text-neutral-400">Chọn vai trò của bạn</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {ROLE_CARDS.map((card) => {
              const body = (
                <>
                  <div className="flex items-center justify-between">
                    <span className={`font-bold transition-transform group-hover:translate-x-0.5 ${card.color}`}>{card.title}</span>
                    <span className="text-[10px] text-neutral-400">{card.tag}</span>
                  </div>
                  <span className="mt-1 block text-[10px] text-neutral-500">{card.sub}</span>
                </>
              );
              const cls = `group rounded-xl border bg-neutral-950 p-3 text-left transition hover:bg-white/5 ${card.hover} ${roleHint === card.key ? 'border-white/30' : 'border-white/10'}`;
              return card.key === 'PLATFORM_ADMIN'
                ? <Link className={cls} href="/admin/login" key={card.key}>{body}</Link>
                : <button className={cls} key={card.key} onClick={() => setRoleHint(card.key)} type="button">{body}</button>;
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-neutral-400 sm:flex-row">
          {mode === 'register' ? <><span>Đã có tài khoản thành viên?</span><Link className="font-semibold text-amber-400 hover:underline" href="/login">Đăng nhập ngay tại đây →</Link></> : <Link className="font-semibold text-amber-400 hover:underline" href="/login">← Quay lại đăng nhập</Link>}
        </div>
      )}
    </>
  );
}
