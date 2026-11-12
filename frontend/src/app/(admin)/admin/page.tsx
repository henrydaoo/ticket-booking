import { ProtectedRoute } from '@/components/auth/protected-route';

export default function AdminBoundary() {
  return (
    <ProtectedRoute isAuthenticated={false}>
      <main>Admin route boundary</main>
    </ProtectedRoute>
  );
}
