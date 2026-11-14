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

Copy `.env.example` to `.env` before starting. Seat initialization,
reservation, booking, Saga, and outbox behavior are implemented in later R2
work packages.

