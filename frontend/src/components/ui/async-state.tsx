import type { ReactNode } from 'react';

export function AsyncState({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error?: string;
  empty?: boolean;
  children: ReactNode;
}) {
  if (loading) return <p role="status">Loading...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (empty) return <p>No results found.</p>;
  return children;
}
