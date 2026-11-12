# Payment Service foundation

Payment Service owns the future payment, provider transaction, webhook, refund, and reconciliation workflows. Foundation provides isolated `payment_db` configuration, Kafka consumer lifecycle, provider configuration placeholders, health/readiness, and a webhook boundary.

No payment or refund business behavior is implemented. Copy `.env.example` to `.env` before starting.

