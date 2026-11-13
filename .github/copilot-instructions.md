
# Project Context

This project is a Cinema Ticket Booking System.

The source-of-truth documents are:

- `docs/requirements/requirements-specification.md`
- `docs/architecture/system-architecture.md`
- `docs/planning/project-roadmap.md`
- The applicable release plan and approved contracts in `docs/`

`docs/requirements/system-overview.md` is local-only historical context and
must not be committed. It may be consulted when available, but a fresh clone
must not depend on it.

Read the relevant documents before working on a task. Do not copy their
business requirements into new guidance files; refer to them instead.
If source-of-truth documents conflict, do not choose one arbitrarily. Identify the conflicting statements, explain their impact, and ask for clarification before proceeding.

# Development Workflow

- Follow an incremental, iterative development workflow.
- Work on one approved task at a time.
- Analyze the requirements before proposing an implementation.
- Read the applicable implementation record and inspect the actual code and
  worktree; distinguish historical evidence from current verification.
- Present the implementation plan in chat before modifying files, including
  affected file groups and why they are needed.
- Wait for explicit user approval before implementing.
- Do not update the implementation record while planning is unapproved.
  When an implementation record does not yet exist, propose its initial scope
  and creation in chat; create it only after explicit plan approval.
- Split work into reviewable behavior-sized tasks without separating
  invariants that must be enforced together. Do not expose unsafe intermediate
  behavior or impose an arbitrary file-count limit.
- Do not expand the scope beyond the approved task.
- Do not automatically proceed to the next task.
- Ask questions when requirements are ambiguous instead of making assumptions.
- Distinguish confirmed requirements, approved architecture, implementation
  choices, assumptions, and open questions.
- Validate the actual acceptance criteria, not a proxy for them.

# Engineering Principles

- Do not invent business requirements.
- Do not introduce or change architectural decisions without explaining their trade-offs and obtaining explicit approval.
- Make implementation-level decisions within the approved requirements and architecture, following existing codebase conventions.
- If an implementation choice affects requirements, architecture, contracts, or the approved scope, explain the impact and ask for approval.
- Do not design the entire database schema upfront.
- Design database changes, APIs, and components incrementally based on the current feature.
- Avoid unnecessary abstractions, dependencies, and premature optimization.
- Follow established conventions and patterns in the existing codebase.
- Keep code modular, readable, maintainable, and testable.
- Preserve existing code and user changes.
- Prefer correctness and explicit boundaries over adding technology.
- Do not add infrastructure, abstractions, caching, retries, or shared packages
  without a concrete requirement and an explained reason.

# Testing

- Write relevant tests alongside each implementation task.
- Run relevant tests after making changes.
- Fix test failures before considering the task complete.
- Do not postpone all testing until the end of development.
- Do not claim tests pass unless they have actually been executed.
- Test business behavior, state transitions, data integrity, security
  boundaries, concurrency, and failure scenarios where applicable.
- Prefer targeted checks. Do not run full CI automatically after every task;
  run required acceptance checks and identify any checks not run or blocked.
- When manual API verification is required, prepare a VS Code REST Client
  `.http` request for the user to inspect and send. Describe prerequisites,
  environment, authentication, expected results, side effects, and cleanup;
  never store real credentials in tracked files.
- Record each relevant check's command, working directory, environment,
  result and coverage as Passed, Failed, Not Run, or Blocked. Do not use
  CI success as a substitute for required integration, migration or API checks.

# Code Review

After implementation:
- Perform an AI self-review of the task diff, including untracked files. This
  is a separate self-check, not an independent review.
- Summarize the files changed.
- Explain the important implementation decisions.
- Report tests executed and their results.
- Provide instructions for the user to verify the change: prerequisites,
  exact commands and working directories, expected results, and what those
  checks do not cover. Include safe manual checks where useful.
- Identify potential issues or remaining work.
- Wait for user review before proceeding.
- During human review, do not make further changes unless requested.
- Review requirements compliance, business correctness, data integrity,
  architecture, security, error handling, contracts, testing, performance,
  and maintainability.

# Git Rules

- Never commit, push, merge, or reset without explicit approval. Approval of
  an implementation plan or review is not approval to commit unless the user
  explicitly authorizes the commit.
- Never discard or overwrite existing user changes.
- Show the Git diff before requesting commit approval.
- Use meaningful commit messages when the user approves a commit.
- From R1.5 onward, commit each task separately after explicit commit approval.
  Do not combine unrelated tasks.
- Do not record commit hashes in implementation plans. Record the approved
  task ID in the commit message so Git history can provide commit evidence.

# AI Tool Usage

- Use available tools and project context to understand the codebase before making changes.
- Do not create files, dependencies, infrastructure, or configuration unless they are required by the approved task.
- Do not assume Docker, databases, CI/CD, or deployment infrastructure already exists.
- Prefer simple solutions that satisfy the current requirements.
- Clearly distinguish verified facts from assumptions.
