# R2 Project Plan — Booking and Payment

**Status:** Approved planning baseline  
**Release:** R2 — Booking and Payment  
**Source of truth:** [Requirements Specification](../../requirements/requirements-specification.md)  
**Architecture baseline:** [System Architecture](../../architecture/system-architecture.md)  
**Roadmap context:** [Project Roadmap](../../planning/project-roadmap.md)  
**Contracts:** [R2 Release Contracts](r2-contracts.md)

## 1. Objective

Deliver the core authenticated booking flow:

- Catalog-published showtimes initialize Booking-owned runtime seat inventory.
- Customers can retrieve a seat map and atomically hold multiple seats.
- Reservations expire according to backend state and can be cancelled.
- Customers can create a price-snapshotted booking from an active reservation.
- Payment is created through the approved VNPay provider boundary.
- Signed callbacks, duplicate delivery, timeout, reconciliation, and minimum
  refund compensation are handled safely.
- Contention tests demonstrate zero double booking and zero overselling.

R2 does not implement ticket issuance, QR check-in, notification business
behavior, customer cancellation/refund policy from R3, or showtime
rescheduling/cancellation workflows.

## 2. Ownership and boundaries

### Booking Service

Booking Service owns:

- Showtime-specific runtime seat inventory.
- Reservations and reservation expiration.
- Bookings and booking state transitions.
- Price snapshots.
- Booking Saga/workflow state.
- Reservation expiration worker.
- Booking Outbox records.

Booking Service is the only service allowed to modify runtime seat inventory.
It may call Catalog through an approved REST contract for pricing/eligibility
validation, but it never accesses `catalog_db`.

### Payment Service

Payment Service owns:

- Payment records and payment state transitions.
- VNPay provider adapter boundary.
- Signed callback verification.
- Webhook receipt deduplication.
- Payment processing deadline and reconciliation worker.
- Refund request state and minimum refund reconciliation.
- Payment Outbox records.

Payment Service never modifies reservations, bookings, runtime inventory, or
tickets directly.

### API Gateway and frontend

The Gateway owns routing, token validation, coarse access checks, correlation
propagation, and rate-limit boundaries. Fine-grained ownership and resource
authorization remain in Booking or Payment.

The frontend communicates only through the Gateway. Its countdown is
presentation only; backend state determines reservation validity.

## 3. Work packages

Implementation proceeds one bounded work package at a time. The plan is the
release artifact; individual implementation plans are kept in the session and
are not created as repository files.

### R2.0 — Contracts, fixtures, and provider boundaries

- Record the R2 HTTP and Kafka contracts in
  [R2 Release Contracts](r2-contracts.md).
- Add deterministic R2 event fixtures.
- Add Booking and Payment owner migrations incrementally.
- Add validated payment deadline and reconciliation interval configuration.
- Add provider-neutral Payment Service port and VNPay signature boundary.
- Add the provider-neutral Identity email port's SMTP production adapter.
- Keep local email delivery available for local/test mode.
- Do not expose a partial seat-hold or payment workflow.

**Exit criteria:**

- Contracts identify ownership, status values, correlation behavior,
  idempotency, and failure semantics.
- No provider secret or SMTP credential is committed.
- Services build without external infrastructure.
- Owner migrations apply to isolated service databases.

### R2.1 — Inventory initialization

- Consume `ShowtimePublished`.
- Initialize Booking-owned `ShowtimeSeat` records idempotently from the
  layout/pricing snapshot.
- Persist inventory readiness.
- Deduplicate event delivery by `eventId`.
- Ensure replay and consumer restart do not duplicate seats or corrupt state.

**Exit criteria:**

- A published showtime becomes inventory-ready exactly once.
- Duplicate and out-of-order delivery is handled according to the event
  contract.
- Booking does not query Catalog DB.

### R2.2 — Atomic reservations

- Implement seat-map retrieval.
- Validate publication, sale window, reservation cutoff, and inventory
  readiness.
- Validate current Catalog pricing through the approved REST boundary.
- Implement all-or-nothing multi-seat reservation.
- Use PostgreSQL conditional updates/constraints for concurrency correctness.
- Persist backend-authoritative `expiresAt`.
- Support reservation idempotency and customer cancellation.
- Publish `BookingCreated` only from a valid booking transition in the later
  booking workflow boundary.

**Exit criteria:**

- One seat cannot be held by two active reservations.
- A failed multi-seat request holds no requested seats.
- Customer ownership is enforced server-side.
- Repeated idempotency requests do not create duplicate reservations.

### R2.3 — Expiration and booking state

- Add Reservation Expiration Worker.
- Implement reservation state machine:

```text
ACTIVE -> PAYMENT_PENDING -> CONFIRMED
ACTIVE -> EXPIRED
ACTIVE -> CANCELLED
```

- Implement booking creation from a valid reservation.
- Snapshot per-seat prices and total in VND.
- Implement booking states:

```text
PENDING_PAYMENT
CONFIRMED
CANCELLED
REFUND_PENDING
REFUNDED
```

- Ensure expiration never blindly releases a payment-processing workflow.
- Persist workflow state needed for reconciliation and restart recovery.

**Exit criteria:**

- Backend expiration, not frontend countdown, determines validity.
- Price changes after reservation do not alter the booking snapshot.
- Reservation and booking transitions are atomic within Booking ownership.

### R2.4 — Payment creation

- Implement Payment Service payment creation.
- Validate booking ownership and `PENDING_PAYMENT` state.
- Use the same idempotency key for retries of one payment operation.
- Generate a VNPay payment URL through the provider adapter.
- Persist provider reference and processing deadline.
- Do not expose provider credentials or raw signed parameters beyond the
  payment URL required by the approved contract.

**Exit criteria:**

- Repeated payment creation with one idempotency key does not create multiple
  provider operations.
- Payment amount equals the booking snapshot.
- Payment deadline is persisted and configurable.

### R2.5 — Webhook and orchestration

- Accept VNPay callbacks through the Payment Service.
- Verify callback signatures before business processing.
- Persist webhook receipt identity for deduplication.
- Map provider results to the Payment state machine.
- Publish `PaymentSucceeded` or `PaymentFailed` through Payment Outbox.
- Consume payment events in Booking Workflow Orchestrator.
- Confirm booking only when reservation/seat ownership remains valid.

**Exit criteria:**

- Invalid signatures have no business effect.
- Duplicate callbacks are safe.
- Payment success advances a valid booking toward confirmation.
- Payment failure cancels eligible workflow state and releases eligible seats.

### R2.6 — Reconciliation and compensation

- Add Payment Reconciliation Worker.
- Distinguish reservation expiration from payment processing deadline.
- Reconcile missing, delayed, or ambiguous provider callbacks.
- Handle late success after seats have been released or reassigned.
- Create idempotent full refund requests for late success.
- Persist refund state and retry/reconcile the minimum required refund flow.
- Recover Saga/workflow state after process restart.

**Exit criteria:**

- `PAYMENT_PENDING` reservations are not released blindly.
- Late success never issues tickets in R2.
- Late success creates at most one refund request.
- Restart and retry do not duplicate payment, booking, or refund effects.

### R2.7 — Frontend booking and payment

- Add seat-map browsing through the Gateway.
- Add seat selection and all-or-nothing reservation feedback.
- Display the backend `expiresAt` countdown.
- Add booking summary using snapshotted prices.
- Add payment redirect/status handling.
- Add basic booking history.
- Render safe validation, conflict, expiration, and payment errors.

**Exit criteria:**

- Customer can discover a showtime, select seats, reserve, create a booking,
  and start payment through the Gateway.
- Frontend does not decide reservation validity.
- Authentication and authorization remain backend-enforced.
- Frontend remains independently buildable without PostgreSQL, Kafka, or
  VNPay availability.

## 4. Dependency order

```text
R2.0 Contracts, fixtures, and provider boundaries
  └── R2.1 Inventory initialization
        └── R2.2 Atomic reservations
              └── R2.3 Expiration and booking state
                    └── R2.4 Payment creation
                          └── R2.5 Webhook and orchestration
                                └── R2.6 Reconciliation and compensation
                                      └── R2.7 Frontend booking and payment
```

No later work package is started automatically after an earlier package
finishes. Each package is reviewed and validated before the next package is
approved.

## 5. Data and transaction rules

- Booking Service owns `booking_db`; Payment Service owns `payment_db`.
- No cross-service joins, foreign keys, repositories, or direct database
  access are allowed.
- Booking inventory writes and reservation state changes use local
  PostgreSQL transactions.
- Payment webhook receipt persistence and payment state changes are atomic
  within Payment Service.
- Outbox records are written in the same local transaction as the business
  state change they publish.
- Provider callbacks and Kafka deliveries are at-least-once and therefore
  require persisted deduplication/idempotency.
- Migrations are owned and executed by the owning service against an
  isolated database.

## 6. Security and reliability rules

- JWT and branch/resource authorization are rechecked by the owning service.
- Customer ownership is derived from authenticated request context, not a
  caller-supplied customer ID.
- Invalid webhook signatures are rejected before state changes.
- Passwords, raw tokens, VNPay hash secrets, provider credentials, SMTP
  passwords, and payment credentials are never logged or committed.
- Error responses contain safe codes and messages only.
- Correlation IDs are propagated across REST, Kafka, provider callbacks, and
  audit/reconciliation logs.
- Retryable operations reuse their idempotency key.
- No frontend timer, cache, or Redis state is the source of truth for
  inventory, reservations, booking, or payment.

## 7. Testing and validation matrix

### Booking

- Inventory initialization unit/integration tests.
- Duplicate `ShowtimePublished` delivery tests.
- Seat-map readiness tests.
- Reservation state-machine tests.
- One-seat contention tests.
- Many-seat contention tests.
- All-or-nothing multi-seat tests.
- Reservation cancellation and expiration tests.
- `PAYMENT_PENDING` expiration protection tests.
- Price snapshot tests.

### Payment

- VNPay provider contract/signature tests.
- Payment creation and amount consistency tests.
- Idempotency tests.
- Invalid signature tests.
- Duplicate webhook tests.
- Payment timeout and delayed callback tests.
- Reconciliation deadline tests.
- Refund request idempotency and state tests.

### Distributed workflow

- Booking-to-Payment event contract tests.
- Outbox atomicity and retry tests.
- Saga recovery after process restart.
- Late successful payment with released/reassigned seats.
- Catalog-to-Booking-to-Payment integration tests.
- Kafka retry and dead-letter behavior where required.

### Performance and frontend

- Initial k6 baseline.
- One-seat contention and multi-seat contention tests.
- Frontend seat-map, reservation countdown, payment redirect/status, and
  error-state smoke tests.
- Independent frontend build without backend infrastructure.

## 8. R2 release acceptance criteria

R2 is complete only when:

1. `ShowtimePublished` initializes Booking-owned inventory idempotently.
2. Customers can retrieve a seat map for an inventory-ready showtime.
3. Multiple seats can be reserved atomically.
4. No seat can be held by two active reservations.
5. Reservation expiration uses backend state and does not blindly release
   payment-processing reservations.
6. Bookings store immutable price snapshots.
7. Payment creation uses VNPay through a provider boundary and idempotency key.
8. Invalid callbacks are rejected and duplicate callbacks are safe.
9. Payment success/failure advances the Booking workflow safely.
10. Late success after release/reassignment creates an idempotent refund
    request and never issues tickets.
11. Refund state is persisted and reconciliation is restart-safe.
12. Contention tests demonstrate zero double booking and zero overselling.
13. Catalog-to-Booking-to-Payment integration tests pass.
14. Frontend booking/payment smoke tests pass without requiring frontend
    direct access to service databases.

## 9. Environment and deployment decisions

- VNPay merchant code, hash secret, URLs, and any provider credentials are
  deployment-managed environment variables.
- SMTP host, port, user, password, and sender address are deployment-managed
  Identity Service variables.
- Local mode uses the existing in-memory email adapter; production SMTP mode
  fails clearly when required configuration is missing.
- Payment processing deadline defaults to 300 seconds.
- Reconciliation interval defaults to 30 seconds.
- Both values are configurable through environment variables.
- No real credential values are stored in this plan, fixtures, `.env.example`,
  tests, or frontend code.
