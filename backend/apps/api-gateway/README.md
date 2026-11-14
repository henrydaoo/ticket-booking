# API Gateway foundation

The gateway is an independently startable NestJS application. It owns routing,
correlation ID propagation, JWT/JWKS validation, coarse authorization, and a
bounded in-memory authentication rate limit. It does not own identity or
catalog data or business logic.

Copy `.env.example` to `.env` before starting. Authentication and catalog routes are only boundaries in Foundation; token validation, rate limiting, and catalog business endpoints are implemented in later steps.

Browser requests are allowed only from the origins listed in `CORS_ORIGINS`.
The local example allows the frontend on ports `3007` for both `localhost` and
`127.0.0.1`; production environments must set an explicit allowlist.

