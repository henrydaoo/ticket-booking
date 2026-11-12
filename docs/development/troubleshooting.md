# Infrastructure troubleshooting

## Compose reports a missing variable

Compose reads the environment file explicitly because the Compose file is nested under `infrastructure/docker/`:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\infrastructure
docker compose --env-file .env -f docker/compose.yml config
```

If interpolation still fails, confirm that `infrastructure/.env` exists and contains all variables from `.env.example`. Do not paste passwords into source files or commit the file.

## A service reports that its database is not ready

Check container health first:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\infrastructure
docker compose --env-file .env -f docker/compose.yml ps
docker compose --env-file .env -f docker/compose.yml exec postgres pg_isready -U postgres -d postgres
```

Then test the service database with its owning role. Use the connection values from `infrastructure/.env` and the service's `.env`, not credentials from another service.

If the role password was changed after the PostgreSQL volume was initialized, changing `.env` alone does not update PostgreSQL. Update the role password deliberately or recreate the local volume:

```powershell
docker compose --env-file .env -f docker/compose.yml down -v
docker compose --env-file .env -f docker/compose.yml up -d
```

The second command destroys local database and Kafka data, so use it only when that loss is acceptable.

## Kafka is not ready

```powershell
Set-Location D:\beandrew\developer\ticket-booking\infrastructure
docker compose --env-file .env -f docker/compose.yml ps kafka
docker compose --env-file .env -f docker/compose.yml logs kafka
docker compose --env-file .env -f docker/compose.yml exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```

Restart the container only after checking the logs:

```powershell
docker compose --env-file .env -f docker/compose.yml restart kafka
```

## Port conflicts

The expected local ports are PostgreSQL `5432`, Kafka `9092`, Gateway `3000`, and backend services `3001`-`3006`. Identify the process holding a port before stopping anything. Do not delete volumes or change credentials to solve a port conflict.

## Frontend validation fails

Run commands from `frontend/`, not the repository root:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\frontend
pnpm install
pnpm run lint
pnpm run test
pnpm run build
```

Frontend validation does not require Docker, PostgreSQL, Kafka, or the backend workspace.

## Backend validation fails

Run commands from `backend/`, not the repository root:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\backend
pnpm install
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

The foundation test and build commands are designed to run without infrastructure. Start Docker only for checks that explicitly need runtime dependencies.

## Backend cannot resolve `@ticket-booking/config`

The shared configuration package must be built before backend type-checking and
service builds. Run the workspace CI command from `backend/`; it performs this
bootstrap automatically:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\backend
pnpm run build:config
pnpm run ci
```

Do not commit generated `dist/` output. A clean checkout must regenerate the
configuration package and each service's build output during CI.
