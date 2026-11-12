'use client';

import type { ReactNode } from 'react';

type ProtectedRouteProps = {
  isAuthenticated: boolean;
  children: ReactNode;
  fallback?: ReactNode;
};

export function ProtectedRoute({
  isAuthenticated,
  children,
  fallback = <p>Authentication is required.</p>,
}: ProtectedRouteProps) {
  return isAuthenticated ? children : fallback;
}
