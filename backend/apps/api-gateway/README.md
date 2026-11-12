# API Gateway foundation

The gateway is an independently startable NestJS application. It owns routing, correlation ID propagation, and explicit JWT/JWKS configuration placeholders. It does not own identity or catalog data or business logic.

Copy `.env.example` to `.env` before starting. Authentication and catalog routes are only boundaries in Foundation; token validation, rate limiting, and catalog business endpoints are implemented in later steps.

