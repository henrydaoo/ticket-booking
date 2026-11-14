import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppShell } from '@/components/layout/app-shell';

export default function StaffBoundary() {
  return (
    <AppShell>
      <ProtectedRoute roles={['CINEMA_MANAGER', 'PLATFORM_ADMIN']}>
        <section className="mx-auto max-w-3xl space-y-4"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">Staff portal</p><h1 className="text-4xl font-semibold text-white">Catalog operations</h1><p className="text-zinc-400">Management actions remain subject to Catalog branch authorization.</p></section>
      </ProtectedRoute>
    </AppShell>
  );
}
