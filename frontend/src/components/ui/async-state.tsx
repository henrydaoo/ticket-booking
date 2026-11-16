import type { ReactNode } from 'react';

export function AsyncState({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error?: string;
  empty?: boolean | ReactNode;
  children: ReactNode;
}) {
  if (loading) return <p role="status">Loading...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (empty) return empty === true ? <p>No results found.</p> : empty;
  return children;
}
