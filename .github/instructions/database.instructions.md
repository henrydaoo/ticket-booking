---
applyTo: "**/*.{sql,ts,js}"
---

# Database guidance

- A database belongs to exactly one service.
- Design schema changes incrementally for the current approved feature; do
  not design the entire system schema in advance.
- Use migrations owned and executed by the service that owns the database.
- Encode applicable invariants with database constraints as well as
  application checks.
- Use transactions for multi-write atomic operations.
- Analyze uniqueness, state transitions, timestamps, retry behavior, and
  concurrent writes before implementing a write workflow.
- Never store passwords, raw refresh tokens, recovery codes, or other
  sensitive credentials in plaintext.
- Do not use local database files as an unintended substitute for the
  service's configured database.
- Never commit secrets or sensitive database contents.
- Integration tests may require controlled infrastructure, but builds,
  type-checks, unit tests, and static validation must not require a running
  database.
