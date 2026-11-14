'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError } from '@/lib/api-client/client';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  confirmPasswordReset,
  login,
  register,
  requestPasswordReset,
  verifyEmail,
} from '@/lib/auth/auth-client';
import type { AuthSession } from '@/lib/auth/auth-boundary';

const authFormSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters.').or(z.literal('')),
  mfaCode: z.string().regex(/^\d{6}$/, 'MFA code must contain 6 digits.').or(z.literal('')),
  token: z.string(),
});

type AuthFormValues = z.infer<typeof authFormSchema>;
type AuthMode = 'login' | 'register' | 'verify' | 'reset';

function safeError(error: unknown): string {
  if (error instanceof ApiError && error.status < 500) return error.message;
  return 'The request could not be completed. Please try again.';
}

function sessionDestination(session: AuthSession): string {
  if (session.user.roles.includes('PLATFORM_ADMIN') && session.user.mfaCompleted) return '/admin';
  if (session.user.roles.includes('CINEMA_MANAGER')) return '/staff';
  return '/account';
}

function schemaForMode(mode: AuthMode) {
  return authFormSchema.superRefine((values, context) => {
    if (mode !== 'verify' && !values.email) {
      context.addIssue({ code: 'custom', path: ['email'], message: 'Email is required.' });
    }
    if (mode === 'login' || mode === 'register' || (mode === 'reset' && values.token)) {
      if (!values.password) {
        context.addIssue({ code: 'custom', path: ['password'], message: 'Password is required.' });
      }
    }
    if ((mode === 'verify' || mode === 'reset') && !values.token) {
      context.addIssue({ code: 'custom', path: ['token'], message: 'Token is required.' });
    }
  });
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [successMessage, setSuccessMessage] = useState('');
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
        ? 'Registration received. Check your email to verify your account.'
        : mode === 'verify'
          ? 'Email verified. You can now sign in.'
          : 'If the account exists, reset instructions were sent.');
      form.reset({ email: '', password: '', mfaCode: '', token: '' });
    },
    onError: (error) => {
      form.setError('root.server', { message: safeError(error) });
    },
  });

  useEffect(() => {
    if (mode === 'verify' || mode === 'reset') {
      form.setValue('token', new URLSearchParams(window.location.search).get('token') ?? '');
    }
  }, [form, mode]);

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
  const token = form.register('token');
  const tokenValue = form.watch('token');
  const fieldError = (name: keyof AuthFormValues) => form.formState.errors[name]?.message;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <h1 className="text-2xl font-semibold text-white">
          {mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : mode === 'verify' ? 'Verify your email' : 'Reset your password'}
        </h1>
        <p className="text-sm text-zinc-400">Use your Cinema Ticket Booking account.</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit} noValidate>
          {mode !== 'verify' && (mode !== 'reset' || !tokenValue) ? (
            <label className="block space-y-2 text-sm text-zinc-300">Email<Input {...email} type="email" autoComplete="email" />{fieldError('email') ? <span className="text-xs text-red-300">{fieldError('email')}</span> : null}</label>
          ) : null}
          {mode === 'verify' || mode === 'reset' ? (
            <label className="block space-y-2 text-sm text-zinc-300">Verification or reset token<Input {...token} />{fieldError('token') ? <span className="text-xs text-red-300">{fieldError('token')}</span> : null}</label>
          ) : null}
          {mode !== 'verify' && (mode !== 'reset' || Boolean(tokenValue)) ? (
            <label className="block space-y-2 text-sm text-zinc-300">Password<Input {...password} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />{fieldError('password') ? <span className="text-xs text-red-300">{fieldError('password')}</span> : null}</label>
          ) : null}
          {mode === 'login' ? (
            <label className="block space-y-2 text-sm text-zinc-300">MFA code (Platform Admin only)<Input {...mfaCode} inputMode="numeric" maxLength={6} placeholder="123456" />{fieldError('mfaCode') ? <span className="text-xs text-red-300">{fieldError('mfaCode')}</span> : null}</label>
          ) : null}
          <Button className="w-full" disabled={mutation.isPending} type="submit">{mutation.isPending ? 'Working...' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'verify' ? 'Verify email' : tokenValue ? 'Reset password' : 'Send reset link'}</Button>
          {successMessage ? <Alert>{successMessage}</Alert> : null}
          {form.formState.errors.root?.server ? <Alert variant="destructive">{form.formState.errors.root.server.message}</Alert> : null}
          <p className="text-center text-sm text-zinc-400">
            {mode === 'login' ? <>Need an account? <Link className="text-emerald-400 hover:text-emerald-300" href="/register">Create one</Link></> : mode === 'register' ? <>Already have an account? <Link className="text-emerald-400 hover:text-emerald-300" href="/login">Sign in</Link></> : <Link className="text-emerald-400 hover:text-emerald-300" href="/login">Back to sign in</Link>}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
