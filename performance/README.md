# R4.3 Performance and contention

The k6 scenarios in this directory require a running, isolated test
environment. They never create or select production data automatically.

## Prerequisites

- k6 installed and available on `PATH`.
- API Gateway running at `PERF_BASE_URL`.
- A test-only customer and published showtime.
- `PERF_SHOWTIME_ID` and `PERF_SEAT_ID` belonging to the test dataset.
- A test-only account configured through `PERF_CUSTOMER_EMAIL` and
  `PERF_CUSTOMER_PASSWORD`.

Example environment:

```powershell
$env:PERF_BASE_URL = "http://localhost:3000"
$env:PERF_CUSTOMER_EMAIL = "performance@example.test"
$env:PERF_CUSTOMER_PASSWORD = "<test-only-password>"
$env:PERF_SHOWTIME_ID = "<test-showtime-id>"
$env:PERF_SEAT_ID = "<test-seat-id>"
```

Run from `performance/`:

```powershell
k6 run k6/baseline.js
k6 run k6/load.js
k6 run k6/stress.js
k6 run k6/spike.js
k6 run k6/soak.js
k6 run k6/mixed-workload.js
k6 run k6/seat-map-concurrency.js
k6 run k6/seat-contention.js
```

The scenarios classify expected reservation conflicts separately from
technical errors. Their summaries must be retained with the workload,
dataset, environment, service revision, and resource assumptions.

Do not run the 500 VU or 1,000-request scenarios against production or an
unisolated local database. Use the verifier scripts after contention runs:

```powershell
Set-Location ..
node backend/scripts/performance/verify-booking-contention.mjs
```

