# Booking Service foundation

Booking Service is the only service configured to own future runtime seat inventory, reservations, bookings, Saga state, and booking outbox records.

Foundation provides:

- Independent `booking_db` connectivity.
- Explicit internal boundaries for inventory, reservation, booking, workflow, workers, and outbox.
- PostgreSQL transaction runner with rollback support.
- Kafka consumer lifecycle and failure logging.
- Worker lifecycle and graceful shutdown hooks.
- A no-op migration runner and concurrency harness.

Copy `.env.example` to `.env` before starting. No seat, reservation, booking, Saga, or outbox business schema is created in Foundation.

