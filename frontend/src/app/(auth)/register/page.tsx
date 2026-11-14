import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/layout/auth-shell';

export default function RegisterPage() {
  return <AuthShell><AuthForm mode="register" /></AuthShell>;
}
