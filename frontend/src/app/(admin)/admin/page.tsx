import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppShell } from '@/components/layout/app-shell';

export default function AdminBoundary() {
  return (
    <AppShell>
      <ProtectedRoute roles={['PLATFORM_ADMIN']} requireMfa>
        <section className="mx-auto max-w-3xl space-y-4"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">Platform admin</p><h1 className="text-4xl font-semibold text-white">Administration</h1><p className="text-zinc-400">Platform operations require backend authorization and completed MFA.</p></section>
      </ProtectedRoute>
    </AppShell>
  );
}
