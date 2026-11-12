# Identity Service foundation

Identity Service is an independently startable NestJS application and the only service configured with `identity_db` credentials. It exposes health/readiness endpoints and explicit JWT key configuration placeholders.

Registration, password handling, role management, MFA, token issuance, and JWKS publication are deferred. Copy `.env.example` to `.env` before starting.

