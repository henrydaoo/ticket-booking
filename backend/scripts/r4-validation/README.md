# R4.4 validation helpers

These scripts validate only explicitly supplied environments. They never
choose an application database, create production-like data, or clean up
resources they did not create.

## Service health

From `backend/`:

```powershell
$env:R4_SERVICE_URLS = "identity=http://localhost:3001,catalog=http://localhost:3002,booking=http://localhost:3003,payment=http://localhost:3004,ticket=http://localhost:3005,notification=http://localhost:3006"
node scripts/r4-validation/validate-health.mjs
```

Both `/health` and `/ready` must return 2xx for every listed service.

## Kafka topic inventory

From `backend/`:

```powershell
$env:R4_KAFKA_BROKERS = "localhost:9092"
$env:R4_KAFKA_TOPICS = "catalog.showtime-published.v1,booking.booking-confirmed.v1,booking.booking-confirmed.v1.dlq.v1"
node scripts/r4-validation/validate-kafka-topics.mjs
```

The topic list must be test-owned when the run is an integration run.
