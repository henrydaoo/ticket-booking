# Contribution conventions

## Scope

Work incrementally from the approved requirements and foundation plan. Keep frontend and backend projects independent and avoid adding root-level package management.

## Before opening a change

Run the relevant checks from the correct project directory:

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

Describe the behavior changed, files affected, validation commands, and any remaining risks. Do not commit, push, merge, or reset without explicit approval.
