import { ProtectedRoute } from '@/components/auth/protected-route';

export default function StaffBoundary() {
  return (
    <ProtectedRoute isAuthenticated={false}>
      <main>Staff route boundary</main>
    </ProtectedRoute>
  );
}
