# Catalog Service foundation

Catalog Service is an independently startable NestJS application and the only service configured with `catalog_db` credentials. Foundation provides health/readiness endpoints, a no-op migration runner, correlation IDs, and Kafka client configuration.

Copy `.env.example` to `.env` before starting. Movie, cinema, screen, seat-layout, showtime, pricing, and event business behavior are deferred to R1 implementation.

The Kafka client is constructed from validated configuration but does not connect or publish events during Foundation. Topic names and event contracts remain deferred.

