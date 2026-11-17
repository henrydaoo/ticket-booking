# Ticket Service

Ticket Service owns issued tickets, QR credentials, ticket status, and check-in
records. The current R3.1 flow consumes `BookingConfirmed` and issues one
ticket per booked seat idempotently. R3.2 adds branch-scoped check-in and
documented check-in reversal for authorized operators. Customer ticket reads
are scoped to the authenticated principal forwarded by the API Gateway.

QR tokens are encrypted at rest and are never published in Kafka events or
application logs. Configure `TICKET_QR_TOKEN_ENCRYPTION_KEY` as a base64-encoded
32-byte key. Copy `.env.example` to `.env` and set the service-owned
`ticket_db` `DATABASE_URL` before running migrations.

