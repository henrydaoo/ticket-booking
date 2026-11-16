'use client';

import { useEffect, useRef } from 'react';
import { clearStoredSession, readSession } from '@/lib/auth/auth-boundary';
import { refreshSession } from '@/lib/auth/auth-client';

const REFRESH_WINDOW_MS = 2 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;

export function SessionLifecycle() {
  const refreshInFlight = useRef(false);

  useEffect(() => {
    const refreshIfNeeded = () => {
      const session = readSession();
      if (
        !session ||
        refreshInFlight.current ||
        session.expiresAt - Date.now() > REFRESH_WINDOW_MS
      ) {
        return;
      }

      refreshInFlight.current = true;
      void refreshSession()
        .catch(() => {
          clearStoredSession();
        })
        .finally(() => {
          refreshInFlight.current = false;
        });
    };

    refreshIfNeeded();
    const intervalId = window.setInterval(refreshIfNeeded, CHECK_INTERVAL_MS);
    window.addEventListener('focus', refreshIfNeeded);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshIfNeeded);
    };
  }, []);

  return null;
}
