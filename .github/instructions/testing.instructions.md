---
applyTo: "**/*.{test,spec}.{ts,tsx,js}"
---

# Testing guidance

- Derive tests from requirements and acceptance criteria, not only from code
  branches.
- Cover successful behavior, invalid input, authorization failures,
  dependency failures, state transitions, and boundary conditions.
- Add concurrency tests for workflows whose correctness depends on competing
  writes or schedule conflicts.
- Test transaction atomicity, rollback, idempotency, duplicate delivery, and
  retry behavior when the feature uses them.
- Keep unit tests independent of PostgreSQL, Kafka, email providers, and other
  infrastructure unless the test is explicitly an integration test.
- Use controlled infrastructure for integration tests and document the exact
  command and working directory.
- Prefer behavior assertions over implementation-detail assertions.
- Do not claim coverage of an acceptance criterion without an executable test
  or other explicit validation evidence.
