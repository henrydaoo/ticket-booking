---
applyTo: "**/*.{test,spec,integration}.{ts,tsx,js,jsx}"
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
- Name and organize tests by behavior or focused scenario. Make independent
  cases independently runnable with their own state; retain multi-step tests
  when the lifecycle itself is the behavior under test.
- Use isolated test-owned data and infrastructure, and clean up only resources
  created by the test. Verify the database target before migrations or tests;
  never silently fall back to a shared or application database.
- Ensure failure injection and background workers cannot affect unrelated
  test cases, pending events, or shared infrastructure.
- Prefer behavior assertions over implementation-detail assertions.
- Do not claim coverage of an acceptance criterion without an executable test
  or other explicit validation evidence.
