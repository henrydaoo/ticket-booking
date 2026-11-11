# API Gateway foundation

The gateway is an independently startable NestJS application. It owns routing, correlation ID propagation, and explicit JWT/JWKS configuration placeholders. It does not own identity data or authentication business logic.

Copy `.env.example` to `.env` before starting. The authentication route is only a boundary in Foundation; token validation and rate limiting are implemented in later steps.

