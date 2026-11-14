---
name: test-design
description: Design requirement-based tests for feature behavior, boundaries, concurrency, failures, and integration isolation.
---

# Test design skill

Convert approved requirements into a test matrix:

- normal flow and successful state transitions;
- validation and malformed input;
- authentication, authorization, role, and branch scope;
- boundary timestamps and configured windows;
- duplicate requests, retries, idempotency, and replay;
- concurrent writes and race conditions;
- transaction rollback and partial dependency failure;
- event publication, duplicate delivery, and consumer behavior;
- frontend loading, empty, unauthorized, and error states.

For each case, identify the owning test layer: unit, service integration,
contract, infrastructure integration, or frontend smoke test. Keep tests
independent of unavailable infrastructure unless that dependency is the
explicit subject of the integration test.

Name tests by behavior and keep independent scenarios runnable independently.
Use multi-step tests when the lifecycle itself is being verified. Identify
fixtures, test-owned resources, isolation, cleanup, and failure injection
before running integration tests; do not affect unrelated data or pending events.

For required manual API verification, prepare a VS Code REST Client request with
prerequisites, target environment, authentication, expected results, side
effects and cleanup. Do not store real credentials. Manual requests supplement
automated tests. Record checks as Passed, Failed, Not Run or Blocked with the
command, working directory, environment and coverage where applicable.
