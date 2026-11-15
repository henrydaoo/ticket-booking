# Booking Service foundation

Booking Service is the only service configured to own future runtime seat inventory, reservations, bookings, Saga state, and booking outbox records.

R2.0 provides:

- Independent `booking_db` connectivity.
- Explicit internal boundaries for inventory, reservation, booking, workflow, workers, and outbox.
- PostgreSQL transaction runner with rollback support.
- Kafka consumer lifecycle and failure logging.
- Worker lifecycle and graceful shutdown hooks.
- Owner migrations for the first inventory, reservation, booking, and outbox
  state boundaries.
- A migration runner that applies repeatable SQL files.

R2.1 consumes `ShowtimePublished` from
`catalog.showtime-published.v1` and initializes the Booking-owned
showtime inventory idempotently. The consumer replays retained events when it
has no committed offset, deduplicates by `eventId`, and performs readiness and
seat writes in one local transaction.

R2.2 exposes authenticated seat-map and reservation boundaries through the
Gateway. Multi-seat holds use a single Booking transaction, validate current
Catalog eligibility/prices through REST, persist a five-minute backend
expiration, and use customer-scoped idempotency keys. Reservation cancellation
releases only seats still held by that reservation.

R2.3 creates `PENDING_PAYMENT` bookings only from customer-owned, non-expired
active reservations. Reservation price rows are copied into immutable booking
seat snapshots in the same transaction. The expiration worker claims only
expired `ACTIVE` reservations and never releases `PAYMENT_PENDING` state.

R2.5 consumes Payment Service success and failure events idempotently. A valid
payment success atomically confirms the booking and reservation and changes
held seats to booked seats. A valid payment failure cancels the eligible
workflow and releases its held seats. Invalid or late success events do not
confirm a booking; compensation and refund handling belong to R2.6.

R2.6 emits one full `RefundRequested` outbox event when a verified payment
success can no longer confirm the booking because its reservation or seats were
released or reassigned.

Copy `.env.example` to `.env` before starting. Seat initialization,
reservation, booking, Saga, and outbox behavior are implemented in later R2
work packages.

