# Contribution conventions

## Scope

Work incrementally from the approved requirements, release plans and
[implementation records](../implementation/README.md). Keep frontend and backend
projects independent and avoid adding root-level package management.

Present each task plan in chat and wait for explicit approval before editing,
including edits to task status. Plan review and commit approval are separate.
From R1.5 onward, commit each task separately only after explicit commit
approval; include the task ID in its commit message.

## Before opening a change

Run checks targeted to the change and its acceptance criteria. Full CI is a
checkpoint chosen by the user or configured pipeline, not an automatic
per-task requirement. When full project validation is requested:

```powershell
# Frontend
Set-Location D:\beandrew\developer\ticket-booking\frontend
pnpm run ci

# Backend
Set-Location D:\beandrew\developer\ticket-booking\backend
pnpm run ci
```

For repository-level whitespace validation:

```powershell
Set-Location D:\beandrew\developer\ticket-booking
git diff --check
```

## Code and architecture

- Preserve service boundaries and database ownership.
- Keep business logic out of the API Gateway.
- Add shared backend packages only for verified technical reuse.
- Do not introduce business schemas, workflows, or event contracts as Foundation shortcuts.
- Prefer focused tests for new behavior.

## Configuration and secrets

- Add safe defaults and placeholders to `.env.example`.
- Never commit `.env`, `.env.local`, private keys, passwords, tokens, or local database files.
- Document required environment variables in the owning project README.

## Changes and review

Perform an AI self-review of the complete task changes, including untracked
files; it is not an independent review. Describe behavior, file groups,
findings, commands, working directories, environments, results and remaining
risks. Mark checks Passed, Failed, Not Run or Blocked. Prepare REST Client
requests for required manual API checks, with environment, side effects and
cleanup explained; do not store real credentials. Do not commit, push, merge,
or reset without explicit approval.
