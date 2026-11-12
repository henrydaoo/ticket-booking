# Development guide

The repository contains independent frontend and backend projects. Run commands from the directory named in each section; there is intentionally no root package manager workspace.

## Prerequisites

- Git
- Node.js `22.14.0` or a compatible Node 22 release
- pnpm `10.18.0`
- Docker Desktop with Docker Compose for local PostgreSQL and Kafka

Verify the tool versions:

```powershell
node --version
pnpm --version
docker --version
docker compose version
```

## Install dependencies

Frontend:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\frontend
pnpm install
```

Backend:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\backend
pnpm install
```

## Validate without infrastructure

Frontend:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\frontend
pnpm run ci
```

Backend:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\backend
pnpm run ci
```

These commands do not require PostgreSQL or Kafka.

The frontend `ci` command is intentionally self-contained. It also works when
the `frontend/` directory is copied or checked out as a standalone project.
The backend `ci` command validates linting, types, all six service directories,
the workspace build, and unit tests.

## Start local infrastructure

Create the local environment file once:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\infrastructure
Copy-Item .env.example .env
```

Replace every placeholder password in `.env`, then start the dependencies:

```powershell
docker compose --env-file .env -f docker/compose.yml up -d
docker compose --env-file .env -f docker/compose.yml ps
```

Stop containers without deleting local data:

```powershell
docker compose --env-file .env -f docker/compose.yml down
```

The `down -v` variant deletes local PostgreSQL and Kafka data and should only be used when a clean reinitialization is intended. See the [infrastructure troubleshooting guide](troubleshooting.md).

## Run a service

Each backend service has its own `.env.example` and README. Copy the example to `.env`, set the service database URL and local runtime values, then use the service commands documented in that README.

The API Gateway listens on port `3000`; the Identity, Catalog, Booking, Payment, Ticket, and Notification services use ports `3001` through `3006`.

The frontend uses `NEXT_PUBLIC_API_BASE_URL`. Copy `frontend/.env.example` to `frontend/.env.local` when a non-default Gateway URL is required.

## Repository hygiene

- Commit `.env.example` files, never `.env` or `.env.local`.
- Do not commit `node_modules`, build output, coverage, logs, or local volumes.
- Keep service database credentials isolated.
- Do not add direct database access across service boundaries.
- Do not start business feature implementation as part of Foundation work.

See [contribution conventions](contributing.md) before opening a change.
