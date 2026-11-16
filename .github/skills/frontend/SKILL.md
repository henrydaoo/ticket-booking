# Frontend UI/UX skill

Use this skill for every frontend feature, redesign, bug fix, and review in
the Cinema Ticket Booking System. These are acceptance rules, not optional
style suggestions. An exception requires a written reason in the plan and
must preserve the requirement and contract boundaries.

## 1. Understand the product before the screen

Before editing:

1. Read the applicable requirements, architecture, release plan, contracts,
   frontend instructions, current routes, and existing feature modules.
2. Identify the actor, goal, entry point, happy path, exit state, failure
   states, recovery path, authorization boundary, and Gateway contract.
3. Build a state matrix for every async journey:
   initial, loading, empty, validation error, unauthorized, forbidden,
   not-found, conflict, dependency failure, retry, success, and stale data
   where applicable.
4. Do not invent business rules, permissions, data, or backend capabilities.
   If a required interaction has no approved contract, stop for clarification
   or show an explicit unavailable state.

## 2. Information architecture and navigation

- Organize code by user-facing capability, not by arbitrary UI type.
- Every page has one clear primary goal and one `h1`.
- Use semantic landmarks: header, navigation, main, aside, and footer where
  their roles are meaningful.
- Define route hierarchy, back behavior, deep-link behavior, and mobile
  navigation before implementing page layouts.
- Navigation must reflect the current actor and role without exposing links
  that the user cannot use.
- Frontend route guards improve UX only; backend services enforce security.
- Do not use generic dashboard placeholders for an approved capability.

## 3. Design system and visual quality

- Use shared design tokens for color, typography, spacing, radii, borders,
  elevation, motion, and breakpoints.
- Establish a deliberate type scale, readable line length, visual hierarchy,
  and consistent density before styling individual pages.
- Use shared primitives for buttons, links, fields, selects, cards, badges,
  alerts, dialogs, tables, tabs, skeletons, and empty states.
- Prefer composition and variants over repeated one-off utility strings.
- Use color to reinforce hierarchy and status, never as the only status cue.
- Icons must have a clear meaning, consistent size, and accessible label or
  be marked decorative.
- Visual polish includes spacing, alignment, contrast, hover/focus/disabled
  states, responsive behavior, and content hierarchy, not only colors.
- Do not apply a new visual language to one page while leaving shared shell
  and primitives inconsistent.

## 3.1 Modern web experience

- Design from content and user intent first. Make the primary action and
  important information visible without forcing users through decoration.
- Use progressive disclosure for secondary detail, advanced filters, and
  infrequent actions. Do not overload the first viewport.
- Compose layouts for small screens first, then enhance them for larger
  screens. Use fluid sizing where appropriate and define deliberate
  max-widths so content remains readable.
- Keep URL state shareable for search, filters, pagination, and meaningful
  tabs. Back/forward navigation must restore the expected view.
- Use micro-interactions only when they communicate cause, progress, state, or
  completion. Respect `prefers-reduced-motion` and avoid distracting motion.
- Optimize perceived performance with immediate navigation feedback, stable
  skeleton geometry, useful empty states, predictable streaming/loading, and
  no avoidable layout shift.
- Use optimistic updates only for reversible, low-risk actions. Use confirmed
  server state for payments, reservations, cancellations, permissions, and
  other business-critical transitions.
- Make copy concise, specific, human, and actionable. Explain what happened,
  what the user can do next, and whether their data was saved.
- Provide page titles, useful metadata, descriptive link text, and appropriate
  image alternatives. Do not sacrifice accessibility or privacy for SEO.
- Support graceful degradation when a dependency is slow or unavailable:
  preserve input, show last-known safe state where appropriate, and provide a
  recovery action.

## 4. Interaction and state behavior

- Every action communicates idle, pending, success, and failure states.
- Disable or guard duplicate submissions while a mutation is pending.
- Preserve user input when a recoverable server request fails.
- Use optimistic updates only when rollback behavior is explicit and safe.
- Confirm destructive or irreversible actions and explain their consequence.
- Restore focus after dialogs, navigation, and failed submissions where
  required for keyboard users.
- Use inline validation for field errors and a summary/live region for
  server or form-level errors.
- Make retry actions specific to the failed dependency; do not add generic
  unexplained refresh buttons.
- Distinguish stale, unavailable, empty, and not-authorized states.
- Never show success before the backend confirms the operation.

## 5. Authentication and sensitive data UX

- Verification and password-reset links are complete user journeys:
  read the token from the URL, submit it once automatically, and never ask
  users to copy raw tokens into an input in the normal flow.
- Render explicit states for reading, verifying, missing, invalid, expired,
  successful, unavailable, retry, and return-to-login actions.
- Do not display raw access tokens, refresh tokens, verification tokens,
  reset tokens, passwords, payment credentials, or provider secrets.
- Treat URL tokens as sensitive: do not log them, place them in analytics,
  preserve them in unrelated links, or render them back into the page.
- Session renewal and refresh-token rotation are background lifecycle
  behavior. Do not expose a generic “Refresh session” product action.
- Handle 401 by attempting the approved session recovery once, then provide
  a clear sign-in path. Avoid refresh loops.
- Handle 403 as an authorization state, not as a generic server failure.
- Do not claim that email was sent or an account was verified unless the
  Gateway response confirms the operation.

## 6. Forms, API boundaries, and server state

- Use React Hook Form with Zod for user-entered forms and boundary
  validation. Do not manage each field with independent `useState`.
- Use TanStack Query for Gateway-backed queries, mutations, loading, errors,
  retries, cache invalidation, and stale data.
- Keep server state separate from local presentation state.
- Communicate only with approved API Gateway contracts; never import backend
  source, database code, or backend workspace packages.
- Map known HTTP outcomes deliberately: 400/422 validation, 401 session,
  403 authorization, 404 missing resource, 409 conflict, and 5xx/dependency
  failure. Use safe user-facing messages.
- Do not expose internal stack traces, SQL errors, raw provider errors, or
  correlation data unnecessarily.
- Invalidate or update query data after mutations according to the contract;
  do not rely on a manual page refresh to show confirmed state.

## 7. Accessibility and responsive behavior

- Use semantic HTML, associated labels, keyboard operation, visible
  `:focus-visible`, accessible names, and meaningful `aria-live` status.
- Dialogs require an accessible title, focus management, escape behavior, and
  focus restoration.
- Respect reduced-motion preferences and avoid motion that blocks operation.
- Maintain readable contrast and do not rely on color alone.
- Use touch targets appropriate for mobile and prevent accidental destructive
  taps.
- Design mobile-first. Define behavior for narrow screens, long content,
  zoom, keyboard appearance, overflow, and orientation changes.
- Prevent avoidable layout shift with stable loading geometry and media
  dimensions.

## 8. Performance and implementation boundaries

- Choose server/client boundaries intentionally; keep browser-only code
  client-side and avoid unnecessary client components.
- Avoid duplicate requests, unbounded polling, and query waterfalls.
- Define image dimensions and loading behavior; do not ship decorative
  assets that obscure primary content.
- Keep modules independently testable and avoid premature shared abstractions.
- Do not add a dependency for styling or state without a concrete approved
  reason.

## 9. Required quality gates

For each bounded package:

1. Present affected files, user journeys, state matrix, contracts, risks, and
   test isolation before editing.
2. Implement one coherent behavior without exposing unsafe intermediate UX.
3. Test user-visible behavior and contract-shaped responses, not implementation
   details or snapshots of incidental markup.
4. Run from `frontend/`:
   `pnpm run lint`, `pnpm run test`, and `pnpm run build`.
5. Self-review requirements, accessibility, responsive behavior, security,
   error handling, API contracts, and maintainability.
6. Report changed files, decisions, checks, uncovered states, and remaining
   risks, then stop for human review.

## 10. Explicit anti-patterns

Do not ship:

- Raw-token input for a link flow that already contains the token in the URL.
- Generic “Refresh session” buttons exposed as ordinary product UI.
- Fake success, silent failure, or a successful-looking fallback.
- Giant unstructured pages with repeated ad hoc Tailwind classes.
- A page that has only a happy path and no recovery state.
- Frontend-only authorization treated as a security boundary.
- A visual redesign that changes business semantics or invents unsupported
  backend actions.
