import { ProtectedRoute } from '@/components/auth/protected-route';

export default function CustomerAccountBoundary() {
  return (
    <ProtectedRoute isAuthenticated={false}>
      <main>Customer route boundary</main>
    </ProtectedRoute>
  );
}
