import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/layout/auth-shell';

export default function VerifyEmailPage() {
  return <AuthShell><AuthForm mode="verify" /></AuthShell>;
}
