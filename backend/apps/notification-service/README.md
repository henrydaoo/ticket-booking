# Notification Service foundation

Notification Service owns the future notification delivery and retry workflows. Foundation provides isolated `notification_db` configuration, Kafka consumer lifecycle, email-provider placeholders, health/readiness, and an email provider boundary.

No notification or email delivery business behavior is implemented. Copy `.env.example` to `.env` before starting.

