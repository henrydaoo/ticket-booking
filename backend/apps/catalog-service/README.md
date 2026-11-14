# Catalog Service foundation

Catalog Service is an independently startable NestJS application and the only
service configured with `catalog_db` credentials. It owns movie, cinema,
branch, screen, physical layout, showtime, pricing, and showtime-publication
data.

Copy `.env.example` to `.env`, ensure PostgreSQL and Kafka are available, apply
the Catalog migrations, and start the service:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\backend\apps\catalog-service
pnpm run migrate
pnpm start
```

The local R1 seed also loads the deterministic cinema, movie, screen, seat,
price, and showtime data used by the frontend:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\backend
pnpm seed:r1
```

The seed is explicit and idempotent. It creates one currently eligible
published showtime, one future-sale published showtime, and one draft
showtime. It uses only local development databases.

Public discovery returns published showtimes. Managers create drafts, set
screen seat-type prices, and publish drafts. Publishing snapshots the prices
and physical seat layout in one Catalog transaction with the Outbox record.
The Outbox publisher retries delivery to `catalog.showtime-published.v1`;
delivery is at-least-once, so consumers must deduplicate by `eventId`.

Catalog's PostgreSQL-backed integration tests require a dedicated test database
that is not used by the application or another process. Create it separately;
the test runner does not create or delete databases. Its name must end in
`_test` and differ from the application database name. Configure
`CATALOG_TEST_DATABASE_URL` and `CATALOG_TEST_DATABASE_CONFIRM` (the database
name) as environment variables or in the ignored `.env.test` file. Never put
real credentials in a tracked file.

The runner checks the configured and connected database names before running
migrations. These checks do not prove isolation; the operator must ensure the
test database is dedicated and that no application or other process uses it.
An advisory lock prevents overlapping runs of this integration runner; it
cannot stop unrelated applications. The tests create and remove test-owned
records and temporarily create a uniquely named trigger for rollback
verification. A fake producer is used; no live Kafka publication is tested.

Run the integration tests from the backend workspace:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\backend
pnpm --filter @ticket-booking/catalog-service run test:integration
```

To run a focused behavior test instead:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\backend
pnpm --filter @ticket-booking/catalog-service run test:integration --test-file=showtime.integration.js --test-name-pattern="concurrent conflicting"
```

