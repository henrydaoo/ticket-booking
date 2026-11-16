import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/layout/auth-shell';

export default function AdminLoginPage() {
  return <AuthShell><AuthForm mode="login" requireMfa /></AuthShell>;
}
