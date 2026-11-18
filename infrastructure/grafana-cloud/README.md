# Grafana Cloud production observability

This directory contains the production Alloy configuration template for
Grafana Cloud. Grafana Cloud is the production observability destination;
local Prometheus and Grafana remain optional development tools only.

## Grafana Cloud values

Create or obtain these values from the Grafana Cloud stack:

| Variable | Source |
|---|---|
| `GRAFANA_CLOUD_PROMETHEUS_URL` | Hosted Prometheus remote-write URL |
| `GRAFANA_CLOUD_PROMETHEUS_USER` | Hosted Prometheus instance ID |
| `GRAFANA_CLOUD_PROMETHEUS_TOKEN` | Cloud access policy token with metrics write permission |
| `GRAFANA_CLOUD_OTLP_ENDPOINT` | Grafana Cloud OTLP endpoint |
| `GRAFANA_CLOUD_OTLP_USER` | Grafana Cloud OTLP username |
| `GRAFANA_CLOUD_OTLP_TOKEN` | Cloud access policy token with traces write permission |

Do not commit these values. Store them in the Alloy runtime secret
configuration.

## Render service values

Each Render service must have a unique `METRICS_TOKEN`:

```text
API Gateway          -> GATEWAY_METRICS_TOKEN
Identity Service     -> IDENTITY_METRICS_TOKEN
Catalog Service      -> CATALOG_METRICS_TOKEN
Booking Service      -> BOOKING_METRICS_TOKEN
Payment Service      -> PAYMENT_METRICS_TOKEN
Ticket Service       -> TICKET_METRICS_TOKEN
Notification Service  -> NOTIFICATION_METRICS_TOKEN
```

The value assigned to each `*_METRICS_TOKEN` in Alloy must match that service's
Render `METRICS_TOKEN`. Each `*_METRICS_TARGET` must be a URL host reachable
from the Alloy runtime. Private Render services require Alloy to run in a
network that can reach them; do not make internal services public only for
metrics scraping.

## Alloy runtime configuration

Copy [config.alloy.example](./config.alloy.example) to the Alloy runtime and
provide all referenced environment variables through its secret manager.
Run Alloy as a persistent Linux service, container, or worker. The Grafana
wizard's `systemd` commands apply to a Linux host, not to a Render web
service.

Set each application service's OTLP endpoint to the Alloy receiver:

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://<alloy-private-host>:4318
```

The application sends traces to Alloy; Alloy authenticates and forwards them
to Grafana Cloud. The observability package also accepts URL-encoded
`OTEL_EXPORTER_OTLP_HEADERS` for direct OTLP exporters when that deployment
model is explicitly chosen.

## Verification

1. Confirm Alloy reports healthy and has no scrape/export errors.
2. Open Grafana Cloud Explore and select the Prometheus data source.
3. Query:

```promql
ticket_booking_http_requests_total
```

4. Open the Tempo data source and search for service names such as
   `payment-service` or `api-gateway`.
