# Ticket Service foundation

Ticket Service owns the future ticket, QR, and check-in workflows. Foundation provides isolated `ticket_db` configuration, Kafka consumer lifecycle, health/readiness, and the future `BookingConfirmed` consumer boundary.

No ticket or check-in business behavior is implemented. Copy `.env.example` to `.env` before starting.

