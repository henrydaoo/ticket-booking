---
name: code-review
description: Review project changes for requirements, business correctness, architecture, security, test quality, and maintainability.
---

# Code review skill

For an AI self-review, inspect the task diff, including untracked files. This is
a separate self-check by the implementing AI, not an independent review.
Review the requested diff or implementation against:

1. Requirements and acceptance criteria.
2. Business rules and state transitions.
3. Data ownership, constraints, transactions, concurrency, and consistency.
4. Service boundaries and dependency direction.
5. Authentication, authorization, validation, secret handling, and safe errors.
6. API/event contract compatibility.
7. Tests for behavior, edge cases, and failure scenarios.
8. Obvious performance and maintainability risks.
9. Feature-module cohesion, dependency direction, and deviations from the
   approved implementation plan. Assess responsibilities and coupling rather
   than treating file length alone as a defect.
10. Test isolation, cleanup safety, independent scenarios, and the diagnostic
    value of failure output.

Report findings with severity, file and line, evidence, impact, and a concrete
fix. Separate confirmed defects from assumptions and open questions. Do not
rewrite unrelated code or treat style preferences as defects.
