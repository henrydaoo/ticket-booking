---
name: project-context
description: Analyze project requirements, approved architecture, release scope, and existing implementation before a feature or review.
---

# Project context skill

Before any implementation or review:

1. Identify the affected release, work package, service, and user flow.
2. Read the relevant requirements, architecture, roadmap, release plan, and
   approved contracts and implementation record in `docs/`. The initial
   system overview is local-only and is consulted only when available.
3. Record confirmed requirements, approved decisions, assumptions, open
   questions, acceptance criteria, and out-of-scope work.
4. Identify service ownership, database ownership, synchronous/asynchronous
   boundaries, and affected frontend flows.
5. Compare the approved plan and relevant existing structure with the current
   implementation and worktree; report deviations and distinguish historical
   test evidence from current verification before proposing changes.
6. Do not design code, schema, endpoints, or infrastructure until the scope
   and constraints are understood.

Stop and ask for clarification when documents conflict or the requested
behavior is not defined by the approved requirements.
