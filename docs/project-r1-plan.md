# R1 Project Plan — Identity and Catalog

**Status:** Approved  
**Release:** R1 — Identity and Catalog  
**Source of truth:** [Requirements Specification](requirements/requirements-specification.md)  
**Architecture baseline:** [System Architecture](architecture/system-architecture.md)  
**Roadmap context:** [Project Roadmap](project-roadmap.md)

## 1. Objective

Deliver the first business-capable release:

- Authenticated customers can register, verify email, sign in, and access the
  system through the API Gateway.
- Platform Admin and Cinema Manager authorization boundaries are established.
- Authorized Cinema Managers can manage catalog data and showtimes within their
  assigned branches.
- Customers can discover movies, cinemas, and published showtimes.
- Catalog publishes `ShowtimePublished` through a Transactional Outbox for the
  later Booking release.

R1 does not implement seat inventory, reservations, bookings, payments,
tickets, check-in, notification delivery, or the Booking Saga.

## 2. Scope and ownership

### Identity Service

Identity Service owns:

- User accounts and profiles.
- Email/password authentication.
- Email verification.
- Password reset.
- Short-lived access tokens.
- Refresh-token rotation and revocation.
- Roles and branch assignments.
- Platform Admin MFA.
- Sensitive identity audit records.
- JWT signing keys and JWKS publication.
- `identity_db` migrations and data.

### API Gateway

The API Gateway owns no identity data or authentication business rules. It
provides:

- Identity and Catalog request routing.
- JWT signature, issuer, audience, and expiry validation using JWKS.
- Correlation ID propagation.
- Coarse-grained access checks.
- A bounded rate-limiting boundary for authentication endpoints.
- Consistent downstream error handling.

Fine-grained resource and branch authorization remains in the owning service.

### Catalog Service

Catalog Service owns:

- Movies and movie status.
- Cinema chains and branches.
- Screens and physical seat layouts.
- Seat types and screen capacity.
- Showtimes.
- Showtime pricing configuration.
- Sale-opening windows.
- Showtime publication and cancellation state.
- Schedule conflict validation.
- `catalog_db` migrations and data.

Catalog does not own runtime `ShowtimeSeat` inventory, reservations, bookings,
payments, tickets, or notification delivery.

### Frontend

The frontend provides:

- Customer authentication flow.
- Movie, cinema, and showtime discovery.
- Initial staff and admin route access boundaries.
- Loading, error, and unauthorized states.

The frontend communicates only through the API Gateway and contains no business
database access.

## 3. Work packages

Implementation proceeds one approved work package at a time.

### R1.0 — Release contracts and test fixtures

- Confirm endpoint and response contracts needed by the frontend and Gateway.
- Define stable identity claims required by Gateway and Catalog, including the
  explicit Platform Admin MFA completion claim.
- Define Catalog publication event envelope required by later Booking work.
- Define test users, roles, branches, and representative catalog fixtures.
- Define a provider-neutral email delivery port and local development adapter
  that exposes verification/reset links without requiring a real provider.
- Record the approved contract baseline in
  [R1.0 Release Contracts](r1-contracts.md).

**Exit criteria:** contracts and open decisions are approved before further
business implementation.

### R1.1 — Identity core

- Add Identity-owned migrations.
- Implement registration and password hashing.
- Implement email verification state and token handling.
- Deliver verification and reset links through the provider-neutral email port;
  use the local development adapter for local runs and automated tests.
- Implement login and short-lived JWT access tokens.
- Implement refresh-token rotation and revocation.
- Implement password reset token lifecycle.
- Implement TOTP enrollment, verification, recovery handling, and audit state
  for Platform Admin MFA.
- Publish JWKS.
- Add identity unit and integration tests.

**Exit criteria:**

- An unverified account cannot authenticate.
- Verified users can obtain an access token.
- Refresh token reuse after rotation or revocation is rejected.
- Password reset invalidates existing refresh tokens.
- A Platform Admin access token is issued with an explicit completed-MFA claim
  only after successful TOTP verification.
- Passwords and raw refresh tokens are not stored.
- Identity data is accessed only through Identity Service.

### R1.2 — Gateway authentication and authorization boundary

- Route all R1 identity operations through the Gateway.
- Validate JWT signature, issuer, audience, expiry, and required claims.
- Refresh JWKS material safely without calling Identity on every request.
- Add coarse-grained role checks where appropriate.
- Require the explicit completed-MFA claim for routes protected by Platform
  Admin MFA; the `PLATFORM_ADMIN` role alone is insufficient.
- Preserve correlation IDs and downstream status codes.
- Add authentication rate-limit protection without introducing Redis unless
  an approved concrete use case requires it.
- Add Gateway authentication tests.

**Exit criteria:**

- Missing, malformed, expired, wrong-audience, and wrong-issuer tokens are
  rejected.
- Valid tokens reach the intended service.
- Gateway does not own user data or identity business logic.
- Authentication failures do not expose credentials or token contents.

### R1.3 — Catalog foundation

- Add Catalog-owned migrations for movies, cinemas, branches, screens,
  layouts, seat types, and pricing references.
- Implement movie management and search/filter behavior.
- Implement cinema chain, branch, screen, and layout management.
- Enforce role and branch authorization for manager operations.
- Catalog must enforce Platform Admin authorization for privileged operations
  and must not rely solely on frontend or Gateway role checks.
- Prevent direct layout modification once a dependent showtime is published or
  has entered the protected lifecycle.
- Do not query Booking Service or `booking_db` to determine layout protection;
  future changes affecting existing showtimes use a controlled workflow.
- Add Catalog unit and integration tests.

**Exit criteria:**

- Customers can read permitted discovery data.
- Cinema Managers can manage only assigned branches.
- Platform Admin can perform platform-wide catalog operations.
- Catalog cannot access `identity_db`.

### R1.4 — Showtime and publication

- Implement showtime creation and management.
- Enforce movie status and configured sale-opening rules.
- Represent reservation cutoff separately from sale opening: reservations are
  rejected from 15 minutes before showtime start, regardless of the configured
  sale-opening time.
- Evaluate showtime and reservation-eligibility timestamps using consistent
  UTC-based instant representations.
- Enforce the 30-minute preparation/cleaning buffer.
- Reject overlapping showtimes on the same screen, including concurrent
  creation attempts.
- Implement pricing configuration and current-price reads.
- Add the Catalog Outbox table and publisher lifecycle; the Foundation Kafka
  producer bootstrap alone is not considered an Outbox implementation.
- Persist the showtime state change and Outbox record in one local transaction.
- Publish `ShowtimePublished` with event ID, aggregate ID, correlation ID,
  occurrence time, and schema version.
- Add retry, duplicate-publication handling, and atomicity integration tests.

**Exit criteria:**

- Discovery visibility and booking eligibility are separate:
  published showtimes may be visible before sale opening, while booking
  eligibility requires publication, an open sale window, and no reservation
  cutoff.
- Catalog exposes the state and timestamps needed by the frontend and later
  Booking validation; Booking remains the final authority for reservation
  eligibility in R2.
- Concurrent schedule conflicts cannot create overlapping showtimes.
- Publication and Catalog state commit atomically.
- A failed publication remains retryable without duplicating business effects.
- Booking can later initialize inventory without querying `catalog_db`.

### R1.5 — Frontend R1 flows

- Connect authentication screens to Gateway.
- Add registration, email verification, login, refresh, logout, and reset
  states.
- Add movie discovery and filtering.
- Add cinema, branch, screen, and showtime browsing.
- Add staff/admin route boundaries and unauthorized states.
- Add frontend smoke tests for the R1 flows.

**Exit criteria:**

- Customer discovery works through the Gateway.
- Authentication errors are rendered without leaking sensitive details.
- Staff and admin routes do not imply authorization without a valid backend
  decision.
- Frontend remains independently buildable without infrastructure.
- Authentication screens depend on R1.2.
- Movie and cinema discovery can use approved contracts and mock fixtures
  during R1.3.
- Showtime discovery integration depends on R1.4 publication and visibility
  contracts.
- Complete frontend integration depends on the corresponding backend
  work-package behavior.

## 4. Dependency order

```text
R1.0
  └── R1.1 Identity core
        └── R1.2 Gateway authentication boundary
              ├── R1.3 Catalog foundation
              │     └── R1.4 Showtime and publication
              └── R1.5 Frontend R1 flows
```

R1.5 is internally staged: authentication depends on R1.2; movie and cinema
discovery may begin after the R1.0 contracts and R1.3 read contracts using
mock fixtures; showtime discovery integration depends on R1.4 contracts and
publication behavior. No R2 implementation may begin before R1.4 publication
behavior is complete.

## 5. Data and migration rules

- Identity Service is the only owner of `identity_db`.
- Catalog Service is the only owner of `catalog_db`.
- No cross-service foreign keys, joins, or direct database access.
- Every business schema change has an owner-service migration.
- Migrations are repeatable in a fresh database and safe to rerun according
  to the repository migration convention.
- Test fixtures use explicit setup and teardown; local volumes are not
  treated as test state.

Detailed schemas and exact endpoint payloads are designed inside the relevant
work package, not all at once.

## 6. Cross-cutting requirements

- Correlation IDs are propagated from frontend to Gateway and services.
- Logs never contain passwords, raw tokens, or payment credentials.
- Administrative permission changes, MFA changes, showtime changes, price
  changes, and publication/cancellation actions are auditable.
- Validation errors use stable, non-sensitive error responses.
- Authentication and Catalog tests must run without unrelated services.
- Integration tests use only the controlled PostgreSQL/Kafka dependencies
  required by that work package.

## 7. R1 acceptance criteria

R1 is complete only when all of the following are demonstrated:

1. A customer can register, verify email, sign in, refresh, and sign out.
2. Password reset works and invalidates prior refresh tokens.
3. Platform Admin MFA is enforced for Platform Admin authentication.
   `PLATFORM_ADMIN` without completed MFA is insufficient for protected routes.
4. Gateway rejects invalid JWTs and routes valid authenticated requests.
5. Cinema Manager access is limited to assigned branches.
6. Platform Admin can perform authorized platform-wide catalog actions.
7. Customers can search and filter movies and browse cinemas, screens, and
   published showtimes, including published showtimes not yet open for sale.
8. Movie status, configured sale-opening, separate 15-minute reservation
   cutoff, and 30-minute buffer rules are enforced.
9. Concurrent overlapping showtime creation is rejected safely.
10. Screen layouts cannot be changed directly after a dependent showtime is
    published or enters the protected lifecycle, without querying Booking DB.
11. Catalog publishes `ShowtimePublished` through a Transactional Outbox.
12. Identity and Catalog ownership/isolation tests pass.
13. Frontend authentication and discovery smoke tests pass.
14. Backend and frontend CI pass from clean project copies without requiring
    unrelated business services.

## 8. Validation matrix

| Area | Required validation |
|---|---|
| Identity | Unit, integration, authentication, token, refresh rotation, reset, MFA tests |
| Gateway | JWT validation, routing, correlation, rate-limit boundary tests |
| Authorization | Role, branch scope, resource ownership, negative tests |
| Catalog | Movie, cinema, screen, layout, pricing, and status rule tests |
| Showtime | Conflict contention, buffer, sale-window, cutoff tests |
| Outbox | Atomic state/outbox transaction, retry, duplicate publication tests |
| Frontend | Auth, discovery, loading/error, unauthorized smoke tests |
| Isolation | Database credential and cross-service access tests |
| CI | Clean-copy frontend/backend validation and repository hygiene |

## 9. Decisions and deferred details

The following decisions are recorded from the approved requirements,
architecture, roadmap, and current release direction:

- Platform Admin MFA uses TOTP. Enrollment, recovery, and audit behavior are
  implemented within Identity Service.
- Identity Service owns user-to-branch assignments and exposes the claims
  required by downstream authorization.
- Email delivery remains provider-neutral in R1 because the requirements and
  architecture do not select a concrete provider. Identity persists and
  validates verification/reset tokens behind an email-delivery boundary, with
  a local development adapter for links and automated tests.
- Gateway rate limiting is an R1 boundary concern. Redis is not introduced
  without the concrete approved use case required by the Foundation rules.
- API error envelopes and event payload versioning are finalized inside the
  relevant work package while preserving the approved service boundaries.
- Couple-seat selection rules remain deferred. The requirements explicitly
  identify this as an open business question, and it is not an R1 acceptance
  criterion.

## 10. Draft-code handling

The current uncommitted Identity changes were created before this plan and are
not considered approved R1 implementation. They remain only as a draft
reference until R1.0 and R1.1 are reviewed against this plan. No additional
R1 business code should be added until R1.0 is explicitly approved. Existing
uncommitted Identity changes remain draft reference material and must be
reviewed before reuse.
