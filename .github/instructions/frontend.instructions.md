---
applyTo: "frontend/**/*.{ts,tsx,js,jsx}"
---

# Frontend guidance

These are strict implementation and review rules for `frontend/`. Follow the
the full frontend UI/UX workflow in
`.github/skills/frontend/SKILL.md`; this file provides the repository-level
invariants that must hold for every frontend change.

## Product and architecture

- Keep the frontend independently installable, testable, lintable, and
  buildable from `frontend/` alone.
- Read the applicable requirements, architecture, release plan, contracts, and
  current route/module implementation before changing a user journey.
- Organize by user-facing capability and define actor, goal, entry point,
  states, recovery path, and exit state before writing UI.
- Communicate only through API Gateway contracts; never import backend source,
  database code, or backend workspace packages.
- Do not invent business rules, permissions, routes, data, or backend
  capabilities. Show an explicit unavailable state or stop for clarification
  when the contract is missing.
- Frontend guards improve navigation and UX only. Backend services remain the
  security boundary.

## Information architecture and design system

- Give every page one primary goal, one `h1`, semantic landmarks, deliberate
  route/back behavior, and role-appropriate navigation.
- Use shared tokens and primitives for typography, spacing, color, contrast,
  surfaces, elevation, radii, buttons, links, fields, cards, alerts, dialogs,
  tables, badges, skeletons, and empty states.
- A redesign must address hierarchy, density, alignment, responsive behavior,
  focus/hover/disabled states, and content—not just colors.
- Keep the shell and visual language consistent across public, auth, customer,
  staff, and admin surfaces.
- Design content-first: expose the primary action and important information
  early, use progressive disclosure for secondary detail, and avoid decorative
  UI that competes with the user goal.
- Compose small-screen layouts first, then enhance for larger screens. Keep
  readable line lengths, deliberate max-widths, stable spacing, and safe
  overflow behavior.
- Keep meaningful filters, tabs, pagination, and search state shareable in the
  URL and compatible with browser back/forward navigation.
- Use micro-interactions only to communicate progress, state, cause, or
  completion. Respect `prefers-reduced-motion`.
- Design for perceived performance: immediate navigation feedback, stable
  skeleton geometry, no avoidable layout shift, and useful empty states.
- Use confirmed server state for reservations, payments, cancellations, and
  permission changes. Optimistic UI requires explicit safe rollback behavior.
- Use concise, specific, actionable copy that tells users what happened and
  what they can do next.
- Add page titles, useful metadata, descriptive links, and meaningful image
  alternatives where applicable without exposing private data.
- When dependencies fail, preserve recoverable input and provide a specific
  recovery action instead of a generic reload instruction.

## State and interaction behavior

- Define and implement relevant loading, empty, validation, unauthorized,
  forbidden, not-found, conflict, dependency-failure, retry, success, and
  stale-data states.
- Communicate pending state, prevent duplicate submissions, preserve recoverable
  input, and never show success before backend confirmation.
- Use specific retry actions and confirmations for destructive operations.
- Do not hide failures, add unexplained refresh buttons, or rely on manual
  browser refresh to reflect confirmed mutations.

## Authentication and sensitive data

- Verification and password-reset links must read tokens from the URL and
  submit them once automatically. Do not render raw-token inputs in the normal
  link flow.
- Provide explicit missing, verifying, success, invalid, expired,
  unavailable, retry, and return-to-login states.
- Never render or log passwords, access tokens, refresh tokens, verification
  tokens, reset tokens, payment credentials, provider secrets, or raw
  infrastructure errors.
- Keep refresh-token rotation and session renewal in the auth lifecycle.
  Never expose a generic “Refresh session” product button.
- Handle 401 with one approved recovery attempt and a sign-in path; handle 403
  as authorization, not as a generic failure.

## Forms, state, accessibility, and responsive UX

- Use React Hook Form with Zod schemas for user-entered forms and boundary
  validation; do not manage each field with independent `useState`.
- Use TanStack Query for Gateway-backed server state, mutations, loading,
  errors, retries, invalidation, and stale data. Keep `useState` for local
  presentation state only.
- Use semantic HTML, associated labels, keyboard operation, visible focus,
  accessible names, `aria-live` status, focus management for dialogs, reduced
  motion, and sufficient contrast.
- Design mobile-first with safe narrow-screen overflow, touch targets,
  long-content behavior, stable loading geometry, and no avoidable layout
  shift.

## Required validation

- Test user-visible behavior and contract-shaped responses rather than
  implementation details or incidental markup.
- Before review, run from `frontend/`:
  `pnpm run lint`, `pnpm run test`, and `pnpm run build`.
- Self-review every package for requirements, contracts, accessibility,
  responsive behavior, security, error handling, performance, and
  maintainability.
