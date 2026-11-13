# Catalog Service foundation

Catalog Service is an independently startable NestJS application and the only
service configured with `catalog_db` credentials. R1.3 provides Catalog-owned
movie, cinema, branch, screen, and physical layout management.

Copy `.env.example` to `.env`, apply the Catalog migration, and start the
service:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\backend\apps\catalog-service
pnpm run migrate
pnpm start
```

Showtime lifecycle, sale windows, schedule conflicts, publication, and Outbox
behavior remain in R1.4.

