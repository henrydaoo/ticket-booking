'use client';

import { useMutation } from '@tanstack/react-query';
import { logout, refreshSession } from '@/lib/auth/auth-client';
import { Button } from '@/components/ui/button';

export function SessionControls() {
  const refreshMutation = useMutation({ mutationFn: refreshSession });
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => window.location.assign('/login'),
  });
  const pending = refreshMutation.isPending || logoutMutation.isPending;

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <Button disabled={pending} onClick={() => refreshMutation.mutate()} type="button" variant="secondary">Refresh session</Button>
        <Button disabled={pending} onClick={() => logoutMutation.mutate()} type="button" variant="ghost">Sign out</Button>
      </div>
      {refreshMutation.isSuccess ? <p role="status">Session refreshed.</p> : null}
      {refreshMutation.isError ? <p role="alert">Your session could not be refreshed. Please sign in again.</p> : null}
      {logoutMutation.isError ? <p role="alert">Sign out could not be completed. Local session was cleared.</p> : null}
    </div>
  );
}
