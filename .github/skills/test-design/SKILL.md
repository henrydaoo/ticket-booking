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
