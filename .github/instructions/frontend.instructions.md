---
applyTo: "frontend/**/*.{ts,tsx,js,jsx}"
---

# Frontend guidance

- Keep the frontend independently installable, testable, lintable, and
  buildable from `frontend/` alone.
- Use the approved Next.js modular structure and organize code by user-facing
  capability.
- Communicate only through API Gateway contracts; do not import backend source,
  database code, or backend workspace packages.
- Model customer, staff, and admin access boundaries explicitly in routes and
  UI states.
- Implement loading, empty, validation, unauthorized, dependency-failure, and
  retry states where the relevant flow requires them.
- Keep business authorization in backend services. Frontend guards improve UX
  but are not security boundaries.
- Test user-visible behavior and integration with contract-shaped responses,
  not component implementation details.
- Use React Hook Form with Zod schemas for user-entered forms and boundary
  validation; do not manage each form field with independent `useState` values.
- Use TanStack Query for Gateway-backed server state, mutations, loading,
  error, retry, and cache behavior. Keep `useState` for local presentation
  state only, such as a filter draft or disclosure toggle.
