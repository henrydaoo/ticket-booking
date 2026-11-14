---
name: feature-implementation
description: Plan, implement, review, and validate an approved project feature or work package within its documented scope.
---

# Feature implementation skill

Use this workflow for an approved feature or work package:

1. Understand the requirement using the project-context workflow.
2. Present a bounded implementation plan in the session listing affected
   files, feature-module responsibilities and dependencies, contracts, data
   and transaction boundaries, edge cases, test isolation, manual
   verification, and validation. Explain the purpose of each affected file
   group.
3. Wait for explicit approval of the chat plan before modifying files.
   Approval of the plan is not approval of a commit.
4. Inspect existing patterns before adding abstractions or dependencies.
5. Implement the smallest reviewable behavior within the approved scope.
   Preserve coupled invariants and do not expose unsafe intermediate behavior.
   For frontend work, use React Hook Form + Zod for forms and TanStack Query
   for Gateway-backed server state unless an approved exception is documented.
6. Review dependency direction, ownership, validation, error handling,
   security, and failure behavior before testing.
7. Run targeted validation and acceptance-required checks; do not automatically
   run full CI after each task. Re-run checks affected by later changes.
8. Compare every acceptance criterion with concrete evidence.
9. Perform an AI self-review, then report files changed, findings, decisions,
   commands with working directories, environments, results, and remaining
   risks. Record Passed, Failed, Not Run or Blocked. For required manual API
   checks prepare REST Client requests with safe environment and cleanup
   instructions.

Do not silently begin the next work package after completion.
