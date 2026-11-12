
# Project Context

This project is a Cinema Ticket Booking System.

The source-of-truth documents are:

- `docs/requirements/system-overview.md`
- `docs/requirements/requirements-specification.md`
- `docs/architecture/system-architecture.md`
- `docs/project-roadmap.md`
- The applicable release plan and approved contracts in `docs/`

Read the relevant documents before working on a task. Do not copy their
business requirements into new guidance files; refer to them instead.
If source-of-truth documents conflict, do not choose one arbitrarily. Identify the conflicting statements, explain their impact, and ask for clarification before proceeding.

# Development Workflow

- Follow an incremental, iterative development workflow.
- Work on one approved task at a time.
- Analyze the requirements before proposing an implementation.
- Present the implementation plan before modifying files.
- Wait for explicit user approval before implementing.
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

# Code Review

After implementation:
- Summarize the files changed.
- Explain the important implementation decisions.
- Report tests executed and their results.
- Identify potential issues or remaining work.
- Wait for user review before proceeding.
- Review requirements compliance, business correctness, data integrity,
  architecture, security, error handling, contracts, testing, performance,
  and maintainability.

# Git Rules

- Never commit, push, merge, or reset without explicit approval.
- Never discard or overwrite existing user changes.
- Show the Git diff before requesting commit approval.
- Use meaningful commit messages when the user approves a commit.

# AI Tool Usage

- Use available tools and project context to understand the codebase before making changes.
- Do not create files, dependencies, infrastructure, or configuration unless they are required by the approved task.
- Do not assume Docker, databases, CI/CD, or deployment infrastructure already exists.
- Prefer simple solutions that satisfy the current requirements.
- Clearly distinguish verified facts from assumptions.
