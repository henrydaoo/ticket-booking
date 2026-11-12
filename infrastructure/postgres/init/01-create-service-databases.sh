#!/bin/bash
set -euo pipefail

create_service_database() {
  local database_name="$1"
  local username="$2"
  local password="$3"

  psql \
    --username "$POSTGRES_USER" \
    --dbname postgres \
    --set ON_ERROR_STOP=1 \
    --set service_username="$username" \
    --set service_password="$password" \
    --set service_database="$database_name" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'service_username', :'service_password')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'service_username'
)\gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'service_database', :'service_username')
WHERE NOT EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'service_database'
)\gexec
SQL

  psql \
    --username "$POSTGRES_USER" \
    --dbname "$database_name" \
    --set ON_ERROR_STOP=1 \
    --set service_username="$username" \
    --set service_database="$database_name" <<'SQL'
REVOKE CONNECT ON DATABASE :"service_database" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"service_database" TO :"service_username";
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO :"service_username";
SQL
}

create_service_database "identity_db" "identity_service" "$IDENTITY_DB_PASSWORD"
create_service_database "catalog_db" "catalog_service" "$CATALOG_DB_PASSWORD"
create_service_database "booking_db" "booking_service" "$BOOKING_DB_PASSWORD"
create_service_database "payment_db" "payment_service" "$PAYMENT_DB_PASSWORD"
create_service_database "ticket_db" "ticket_service" "$TICKET_DB_PASSWORD"
create_service_database "notification_db" "notification_service" "$NOTIFICATION_DB_PASSWORD"

