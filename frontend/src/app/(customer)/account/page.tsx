import { ProtectedRoute } from '@/components/auth/protected-route';
import { SessionControls } from '@/components/auth/session-controls';
import { AppShell } from '@/components/layout/app-shell';

export default function CustomerAccountBoundary() {
  return (
    <AppShell>
      <ProtectedRoute>
        <section className="mx-auto max-w-2xl space-y-6"><h1 className="text-4xl font-semibold text-white">Your account</h1><p className="text-zinc-400">Manage your active session.</p><SessionControls /></section>
      </ProtectedRoute>
    </AppShell>
  );
}
