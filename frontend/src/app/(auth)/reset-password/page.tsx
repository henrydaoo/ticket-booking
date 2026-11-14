import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/layout/auth-shell';

export default function ResetPasswordPage() {
  return <AuthShell><AuthForm mode="reset" /></AuthShell>;
}
