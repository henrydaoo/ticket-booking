---
applyTo: "backend/**/*.ts,backend/**/*.js,backend/**/*.json"
---

# Backend guidance

- Use NestJS modules organized around business capabilities.
- Keep distinct capabilities in cohesive feature modules with focused
  controllers, services, repositories, and DTOs. Do not group unrelated
  capabilities solely because they belong to the same service, or create a
  module for every database table.
- Explain module responsibilities, dependencies, and any shared transaction
  boundaries in the implementation plan. Preserve atomicity and locking when
  code is split across modules.
- Keep controllers focused on transport concerns: DTO binding, validation,
  authentication context, and response mapping.
- Keep business rules in application services or domain-focused components.
- Keep SQL and persistence operations behind the owning service's
  persistence boundary. Do not put SQL in controllers. Keep business
  services independent of persistence-specific details.
- Define ports in the application/feature layer and implementations in
  infrastructure when a dependency crosses an external boundary.
- Use explicit DTOs and typed responses. Do not use inline request shapes or
  broad `Record<string, unknown>` responses for public contracts.
- Validate input with the project's NestJS validation setup and never log
  passwords, raw tokens, secrets, or payment credentials.
- Use transactions for operations that require atomicity and test rollback,
  retry, and duplicate behavior where relevant.
- Keep health checks, database clients, email providers, Kafka clients, and
  other technical concerns outside business feature modules unless the module
  owns the corresponding business behavior.
