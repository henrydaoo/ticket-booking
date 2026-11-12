---
applyTo: "**/*"
---

# Project architecture guidance

- Treat the approved requirements, architecture, roadmap, release plans, and
  contracts in `docs/` as the source of truth.
- Preserve the six service boundaries: Identity, Catalog, Booking, Payment,
  Ticket, and Notification.
- Each service owns its business data and database. Do not add cross-service
  joins, foreign keys, repositories, or direct database access.
- Use REST for synchronous interactions and Kafka only for approved
  asynchronous domain events.
- Keep business logic in the owning service. The API Gateway performs routing,
  token validation, coarse access checks, and correlation propagation; it does
  not own business data or rules.
- Apply distributed transactions only where the approved workflow requires
  them. Do not introduce Saga, Outbox, or event choreography into unrelated
  features.
- Keep frontend and backend independently buildable.
- Explain trade-offs before changing an approved architectural decision.
