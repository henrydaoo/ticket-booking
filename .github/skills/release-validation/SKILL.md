---
name: release-validation
description: Validate release acceptance criteria against concrete backend, frontend, contract, infrastructure, and test evidence.
---

# Release validation skill

Validate a release against its approved acceptance criteria:

1. Read the release plan, contracts, roadmap scope, and relevant requirements.
2. Turn every acceptance criterion into a pass/fail checklist with a specific
   test or other evidence, including checks that are unverified or blocked.
3. Validate backend services, frontend flows, contracts, migrations, security
   boundaries, and required infrastructure independently.
4. Run commands from the documented project directories and record exact
   results, environment and scope; label unavailable checks Not Run or Blocked.
   Full CI is performed at an appropriate user-selected checkpoint or by the
   configured pipeline, not automatically for every task.
5. Verify clean-checkout and project-independence requirements where applicable.
6. Check that no secrets, local database files, or out-of-scope artifacts are
   committed.
7. Report evidence for each criterion, failed checks, unresolved risks, and
   work explicitly deferred to a later release. Distinguish fake dependencies
   from real infrastructure and do not infer consumer behavior from publisher
   tests alone.

Do not declare a release complete based only on build success or unit-test
success. CI does not replace acceptance-required integration, migration or
manual API verification.
