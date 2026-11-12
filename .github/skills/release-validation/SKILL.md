# Release validation skill

Validate a release against its approved acceptance criteria:

1. Read the release plan, contracts, roadmap scope, and relevant requirements.
2. Turn every acceptance criterion into a pass/fail checklist.
3. Validate backend services, frontend flows, contracts, migrations, security
   boundaries, and required infrastructure independently.
4. Run commands from the documented project directories and record exact
   results.
5. Verify clean-checkout and project-independence requirements where applicable.
6. Check that no secrets, local database files, or out-of-scope artifacts are
   committed.
7. Report evidence for each criterion, failed checks, unresolved risks, and
   work explicitly deferred to a later release.

Do not declare a release complete based only on build success or unit-test
success.
