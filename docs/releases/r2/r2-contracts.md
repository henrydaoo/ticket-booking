# R2 Release Contracts — Booking and Payment

**Status:** Approved R2 baseline  
**Release:** R2 — Booking and Payment  
**Source of truth:** [Requirements Specification](../../requirements/requirements-specification.md)  
**Architecture baseline:** [System Architecture](../../architecture/system-architecture.md)  
**Roadmap context:** [R2 Project Plan](project-r2-plan.md)

This document defines the externally visible HTTP contracts and the
cross-service event contracts required by R2. It does not define service
database schemas, ORM entities, provider credentials, or frontend component
implementation.

## 1. Contract rules

All external requests enter through the API Gateway. Services receive the
Gateway-provided `X-Correlation-Id` and preserve it in responses, logs, and
published events.

Successful responses use the status codes and JSON shapes below. Errors use
the stable envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A safe human-readable message",
    "details": []
  },
  "correlationId": "corr-01J00000000000000000000000"
}
```

Error messages must not expose passwords, raw tokens, payment credentials,
provider secrets, stack traces, or internal SQL details.

All timestamps are UTC instants represented as ISO-8601 strings with `Z` or an
explicit offset. All money values are integer VND (`priceVnd`, `totalVnd`,
`amountVnd`); decimal monetary values are not accepted.

## 2. Seat inventory and reservation HTTP contracts

### 2.1 Seat-map retrieval

| Method | Route | Access | Success |
|---|---|---|---|
| GET | `/booking/showtimes/{showtimeId}/seats` | Authenticated customer | `200` with the showtime seat map |

Response:

```json
{
  "showtimeId": "showtime-r1-open-001",
  "inventoryReady": true,
  "reservationCutoffAt": "2030-01-15T11:45:00Z",
  "seats": [
    {
      "seatId": "seat-r1-a1",
      "label": "A1",
      "type": "STANDARD",
      "priceVnd": 90000,
      "status": "AVAILABLE"
    }
  ]
}
```

Runtime seat status is one of `AVAILABLE`, `HELD`, or `BOOKED`. `priceVnd` is
the current Catalog price used for reservation validation; it is not the final
booking price until the reservation snapshot is created.

If inventory has not been initialized from `ShowtimePublished`, the service
returns `409` with `INVENTORY_NOT_READY`. Booking does not read
`catalog_db` directly.

### 2.2 Create reservation

| Method | Route | Access | Success |
|---|---|---|---|
| POST | `/booking/reservations` | Authenticated customer | `201` |

Request:

```json
{
  "showtimeId": "showtime-r1-open-001",
  "seatIds": ["seat-r1-a1", "seat-r1-a2"],
  "idempotencyKey": "reserve-customer-001-0001"
}
```

The request is all-or-nothing. If any requested seat is unavailable, expired,
already held, or already booked, no requested seat is held.

Response:

```json
{
  "reservationId": "reservation-r2-001",
  "customerId": "user-customer-001",
  "showtimeId": "showtime-r1-open-001",
  "status": "ACTIVE",
  "seatIds": ["seat-r1-a1", "seat-r1-a2"],
  "seatPrices": [
    { "seatId": "seat-r1-a1", "priceVnd": 90000 },
    { "seatId": "seat-r1-a2", "priceVnd": 90000 }
  ],
  "totalVnd": 180000,
  "expiresAt": "2030-01-15T12:05:00Z"
}
```

`expiresAt` is issued by the backend and is authoritative. The frontend
countdown never determines validity. The default duration is five minutes
from successful backend creation.

The request uses the authenticated customer from the Gateway context; a
customer ID in the body is not accepted. The same idempotency key and
equivalent request return the original result without creating another
reservation.

### 2.3 Cancel reservation

| Method | Route | Access | Success |
|---|---|---|---|
| POST | `/booking/reservations/{reservationId}/cancel` | Owning authenticated customer | `200` |

Response:

```json
{
  "reservationId": "reservation-r2-001",
  "status": "CANCELLED",
  "releasedAt": "2030-01-15T12:02:00Z"
}
```

Cancellation is idempotent for an already cancelled reservation. An expired
or confirmed reservation is not treated as an active reservation.

## 3. Booking HTTP contracts

### 3.1 Create booking

| Method | Route | Access | Success |
|---|---|---|---|
| POST | `/booking/bookings` | Owning authenticated customer | `201` |

Request:

```json
{
  "reservationId": "reservation-r2-001",
  "idempotencyKey": "booking-customer-001-0001"
}
```

Response:

```json
{
  "bookingId": "booking-r2-001",
  "reservationId": "reservation-r2-001",
  "showtimeId": "showtime-r1-open-001",
  "status": "PENDING_PAYMENT",
  "seats": [
    { "seatId": "seat-r1-a1", "priceVnd": 90000 },
    { "seatId": "seat-r1-a2", "priceVnd": 90000 }
  ],
  "totalVnd": 180000,
  "paymentDeadlineAt": "2030-01-15T12:10:00Z"
}
```

The booking is created only from an active reservation owned by the
authenticated customer. The per-seat prices and total are snapshots and are
not recalculated from later Catalog changes.

Booking states are:

```text
PENDING_PAYMENT
CONFIRMED
CANCELLED
REFUND_PENDING
REFUNDED
```

The state machine is enforced by Booking Service. Payment Service does not
update booking or seat state directly.

### 3.2 Booking retrieval

| Method | Route | Access | Success |
|---|---|---|---|
| GET | `/booking/bookings` | Authenticated customer | `200` |
| GET | `/booking/bookings/{bookingId}` | Owning authenticated customer, or authorized operator | `200` |

Customer responses include only the customer's bookings and the fields
required for payment and booking history. Staff and operator views must not
expose unrelated sensitive customer information.

## 4. Payment HTTP contracts

### 4.1 Create payment

| Method | Route | Access | Success |
|---|---|---|---|
| POST | `/payment/payments` | Owning authenticated customer | `201` |

Request:

```json
{
  "bookingId": "booking-r2-001",
  "idempotencyKey": "payment-customer-001-0001"
}
```

Response:

```json
{
  "paymentId": "payment-r2-001",
  "bookingId": "booking-r2-001",
  "status": "PENDING",
  "amountVnd": 180000,
  "provider": "VNPAY",
  "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?...",
  "processingDeadlineAt": "2030-01-15T12:10:00Z"
}
```

The URL is generated by the Payment Service through its provider adapter.
The hash secret, merchant code, API credentials, and raw provider secrets are
never returned in the response or logs.

Payment states are:

```text
PENDING
PROCESSING
SUCCEEDED
FAILED
REFUND_PENDING
REFUNDED
```

The same idempotency key represents the same payment operation and must not
create a second provider transaction.

### 4.2 Payment status

| Method | Route | Access | Success |
|---|---|---|---|
| GET | `/payment/payments/{paymentId}` | Owning authenticated customer, or authorized operator | `200` |

Response:

```json
{
  "paymentId": "payment-r2-001",
  "bookingId": "booking-r2-001",
  "status": "SUCCEEDED",
  "amountVnd": 180000,
  "provider": "VNPAY",
  "providerReference": "vnpay-r2-001",
  "updatedAt": "2030-01-15T12:06:00Z"
}
```

### 4.3 Provider webhook

| Method | Route | Access | Success |
|---|---|---|---|
| POST | `/payment/webhooks/vnpay` | Payment provider callback only | `200` |

The endpoint accepts the provider's raw callback parameter set. Payment
Service verifies the VNPay signature before applying any state transition.
Invalid signatures return `400` with `INVALID_WEBHOOK_SIGNATURE` and cause no
business effect.

Duplicate callbacks are safe. A provider callback is deduplicated by its
provider event/reference identity and the persisted payment state transition.
The endpoint does not expose internal booking state or provider secrets.

## 5. Event envelope

All R2 Kafka events use this envelope:

```json
{
  "eventId": "event-r2-0001",
  "eventType": "BookingCreated",
  "schemaVersion": 1,
  "aggregateType": "Booking",
  "aggregateId": "booking-r2-001",
  "occurredAt": "2030-01-15T12:05:00Z",
  "correlationId": "corr-01J00000000000000000000000",
  "payload": {}
}
```

`eventId` is stable across publication retries. `aggregateId` is the message
key for aggregate ordering. Outbox delivery is at-least-once; consumers must
deduplicate by `eventId` and make state transitions idempotent.

## 6. R2 events

### 6.1 `ShowtimePublished`

**Topic:** `catalog.showtime-published.v1`  
**Producer:** Catalog Service  
**Consumer:** Booking Service

The R1 `ShowtimePublished` payload is reused. It contains the showtime,
screen, layout version, seat layout snapshot, pricing version, and seat-type
prices. Booking uses the snapshot to initialize runtime inventory and does
not query Catalog DB.

### 6.2 `BookingCreated`

**Topic:** `booking.booking-created.v1`  
**Producer:** Booking Service  
**Consumer:** Payment Service

```json
{
  "eventType": "BookingCreated",
  "schemaVersion": 1,
  "aggregateType": "Booking",
  "payload": {
    "bookingId": "booking-r2-001",
    "reservationId": "reservation-r2-001",
    "customerId": "user-customer-001",
    "showtimeId": "showtime-r1-open-001",
    "totalVnd": 180000,
    "paymentDeadlineAt": "2030-01-15T12:10:00Z",
    "seats": [
      { "seatId": "seat-r1-a1", "priceVnd": 90000 },
      { "seatId": "seat-r1-a2", "priceVnd": 90000 }
    ]
  }
}
```

### 6.3 `PaymentSucceeded`

**Topic:** `payment.payment-succeeded.v1`  
**Producer:** Payment Service  
**Consumer:** Booking Service

```json
{
  "eventType": "PaymentSucceeded",
  "schemaVersion": 1,
  "aggregateType": "Payment",
  "payload": {
    "paymentId": "payment-r2-001",
    "bookingId": "booking-r2-001",
    "amountVnd": 180000,
    "provider": "VNPAY",
    "providerReference": "vnpay-r2-001"
  }
}
```

### 6.4 `PaymentFailed`

**Topic:** `payment.payment-failed.v1`  
**Producer:** Payment Service  
**Consumer:** Booking Service

```json
{
  "eventType": "PaymentFailed",
  "schemaVersion": 1,
  "aggregateType": "Payment",
  "payload": {
    "paymentId": "payment-r2-001",
    "bookingId": "booking-r2-001",
    "reasonCode": "PROVIDER_DECLINED",
    "retryable": false
  }
}
```

`reasonCode` is a safe machine-readable value. Provider response text and
credentials are not published.

### 6.5 `ReservationExpired`

**Topic:** `booking.reservation-expired.v1`  
**Producer:** Booking Service  
**Consumers:** Payment Service and audit/reconciliation consumers as approved

```json
{
  "eventType": "ReservationExpired",
  "schemaVersion": 1,
  "aggregateType": "Reservation",
  "payload": {
    "reservationId": "reservation-r2-001",
    "bookingId": null,
    "showtimeId": "showtime-r1-open-001",
    "seatIds": ["seat-r1-a1", "seat-r1-a2"],
    "expiredAt": "2030-01-15T12:05:00Z"
  }
}
```

`bookingId` is nullable. It is `null` when an active reservation expires before
the customer creates a booking; a future workflow may populate it when a
payment-pending booking is explicitly expired. The consumer must not interpret this event as permission to release seats
that are in payment processing without checking the persisted workflow state.

### 6.6 `RefundRequested`

**Topic:** `payment.refund-requested.v1`  
**Producer:** Booking Service  
**Consumer:** Payment Service

```json
{
  "eventType": "RefundRequested",
  "schemaVersion": 1,
  "aggregateType": "Booking",
  "payload": {
    "bookingId": "booking-r2-001",
    "paymentId": "payment-r2-001",
    "amountVnd": 180000,
    "reasonCode": "PAYMENT_SUCCEEDED_AFTER_SEAT_RELEASE"
  }
}
```

Refund requests use an idempotency key derived from the business operation.
Partial refunds are not supported in R2.

## 7. State and failure rules

- One active reservation may own a seat for a showtime.
- Multi-seat reservation failure releases all seats in the attempted request.
- Reservation expiration is authoritative in Booking Service.
- Reservation expiration and payment processing deadline are separate.
- A `PAYMENT_PENDING` workflow is not blindly released by the expiration
  worker.
- Payment success confirms a booking only if the reservation/seat ownership
  is still valid.
- Late success after release or reassignment produces no ticket event and
  creates one idempotent refund request.
- Duplicate webhooks and duplicate Kafka deliveries must not duplicate state
  transitions, bookings, refunds, or outbox effects.
- Ticket issuance is outside R2 and must not be produced by Payment Service.

## 8. Versioning and fixture policy

HTTP and event contracts use explicit versioned changes. A breaking change
requires an approved contract revision rather than silently changing the
payload.

Deterministic R2 fixtures live under
`backend/test/fixtures/r2/`. They contain test identifiers only and never
contain provider credentials, hash secrets, SMTP passwords, or real customer
data.
