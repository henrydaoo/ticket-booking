# Payment Service foundation

Payment Service owns the future payment, provider transaction, webhook, refund, and reconciliation workflows. Foundation provides isolated `payment_db` configuration, Kafka consumer lifecycle, provider configuration placeholders, health/readiness, and a webhook boundary.

R2.0 defines the VNPay provider boundary and the owner migrations for payment,
webhook receipt, refund, and outbox state. R2.4 creates idempotent payment
operations from Booking-owned payment context and returns a signed VNPay URL.
R2.5 verifies VNPay callbacks, persists deduplicated receipts, publishes
`PaymentSucceeded` or `PaymentFailed` through the Payment outbox, and forwards
the public webhook route through the Gateway without customer authentication.
Copy `.env.example` to `.env` and provide VNPay credentials through deployment
secrets before starting.

