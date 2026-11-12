# Code review skill

Review the requested diff or implementation against:

1. Requirements and acceptance criteria.
2. Business rules and state transitions.
3. Data ownership, constraints, transactions, concurrency, and consistency.
4. Service boundaries and dependency direction.
5. Authentication, authorization, validation, secret handling, and safe errors.
6. API/event contract compatibility.
7. Tests for behavior, edge cases, and failure scenarios.
8. Obvious performance and maintainability risks.

Report findings with severity, file and line, evidence, impact, and a concrete
fix. Separate confirmed defects from assumptions and open questions. Do not
rewrite unrelated code or treat style preferences as defects.
