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

Copy `.env.example` to `.env` before starting. Seat initialization,
reservation, booking, Saga, and outbox behavior are implemented in later R2
work packages.

