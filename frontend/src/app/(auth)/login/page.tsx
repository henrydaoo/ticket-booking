import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/layout/auth-shell';

export default function LoginPage() {
  return <AuthShell><AuthForm mode="login" /></AuthShell>;
}
