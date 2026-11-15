# Local infrastructure

This directory contains local runtime dependencies for the Cinema Ticket Booking System. Infrastructure is not required to install, lint, test, or build the frontend and backend projects.

## Prerequisites

- Docker Desktop with Docker Compose
- A copy of `.env.example` named `.env`

```powershell
Copy-Item .env.example .env
```

Replace the placeholder passwords in `.env` before starting the containers. The `.env` file is ignored and must not be committed.

## Start and stop

Run commands from this directory:

```powershell
docker compose --env-file .env -f docker/compose.yml up -d
docker compose --env-file .env -f docker/compose.yml ps
docker compose --env-file .env -f docker/compose.yml down
```

To remove local data and re-run database initialization:

```powershell
docker compose --env-file .env -f docker/compose.yml down -v
```

The volume removal command is destructive for local database and Kafka data.

## Services

| Component | Host port | Purpose |
|---|---:|---|
| PostgreSQL | 5432 | One local server hosting six independent service databases |
| Kafka | 9092 | Local event streaming broker |

PostgreSQL databases and owning credentials:

| Database | Owner role |
|---|---|
| `identity_db` | `identity_service` |
| `catalog_db` | `catalog_service` |
| `booking_db` | `booking_service` |
| `payment_db` | `payment_service` |
| `ticket_db` | `ticket_service` |
| `notification_db` | `notification_service` |

The initialization script revokes database `CONNECT` from `PUBLIC` and grants it only to the owning service role. It also removes default public-schema privileges. No business tables or schemas are created.

## Readiness checks

```powershell
docker compose --env-file .env -f docker/compose.yml ps
docker compose --env-file .env -f docker/compose.yml exec postgres pg_isready -U postgres -d postgres
docker compose --env-file .env -f docker/compose.yml exec kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```

Both containers report `healthy` after their readiness checks pass. After Kafka becomes healthy, create the R2 event topics from the Kafka
container. This uses the broker's local listener and avoids the advertised
`localhost:9092` address intended for host processes:

```powershell
docker compose --env-file .env -f docker/compose.yml exec kafka `
  /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 `
  --create --if-not-exists --topic catalog.showtime-published.v1 `
  --partitions 1 --replication-factor 1

docker compose --env-file .env -f docker/compose.yml exec kafka `
  /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 `
  --create --if-not-exists --topic payment.payment-succeeded.v1 `
  --partitions 1 --replication-factor 1

docker compose --env-file .env -f docker/compose.yml exec kafka `
  /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 `
  --create --if-not-exists --topic payment.payment-failed.v1 `
  --partitions 1 --replication-factor 1

docker compose --env-file .env -f docker/compose.yml exec kafka `
  /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 `
  --create --if-not-exists --topic payment.refund-requested.v1 `
  --partitions 1 --replication-factor 1
```

