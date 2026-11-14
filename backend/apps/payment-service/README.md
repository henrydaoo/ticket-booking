# Payment Service foundation

Payment Service owns the future payment, provider transaction, webhook, refund, and reconciliation workflows. Foundation provides isolated `payment_db` configuration, Kafka consumer lifecycle, provider configuration placeholders, health/readiness, and a webhook boundary.

R2.0 defines the VNPay provider boundary and the owner migrations for payment,
webhook receipt, refund, and outbox state. Copy `.env.example` to `.env` and
provide VNPay credentials through deployment secrets before starting. Payment
workflow behavior is implemented in later R2 work packages.

