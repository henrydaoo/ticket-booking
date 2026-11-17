# Notification Service

Notification Service owns notification jobs, delivery attempts, reminder
scheduling, retries, and dead-letter state in `notification_db`. It consumes
versioned business events through Kafka and sends email through the configured
provider boundary.

Email delivery failure never changes the originating booking, payment, ticket,
refund, or check-in state. Copy `.env.example` to `.env` before starting.

