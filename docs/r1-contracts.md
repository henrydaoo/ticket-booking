# R1.0 Release Contracts

**Status:** Approved for R1.1 implementation  
**Scope:** Identity, API Gateway, Catalog discovery, and email delivery boundary  
**Source of truth:** [R1 Project Plan](project-r1-plan.md)

This document defines the stable contracts required before R1.1-R1.5 business
implementation. It does not define database schemas, service-internal
modules, or the concrete email provider.

## 1. Common HTTP contract

All external requests enter through the API Gateway. Services receive the
Gateway-provided `X-Correlation-Id` value and include it in their response
metadata and logs.

Successful responses use the resource-specific HTTP status and JSON body
defined below. Validation and authorization failures use:

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

The `message` and `details` values must not contain passwords, raw tokens,
payment credentials, or internal stack traces. Error codes are stable
machine-readable values; messages may be localized later.

## 2. Identity HTTP contracts

The Gateway exposes the following Identity routes without requiring an access
token:

| Method | Route | Request | Success |
|---|---|---|---|
| POST | `/auth/register` | `{ "email", "password" }` | `201` with `userId`, `email`, `emailVerified: false`, and `verificationDelivery` |
| POST | `/auth/verify-email` | `{ "token" }` | `200` with `{ "verified": true }` |
| POST | `/auth/login` | `{ "email", "password" }` | `200` with an access/refresh token pair |
| POST | `/auth/refresh` | `{ "refreshToken" }` | `200` with a rotated access/refresh token pair |
| POST | `/auth/logout` | `{ "refreshToken" }` | `200` with `{ "revoked": true }` |
| POST | `/auth/password-reset/request` | `{ "email" }` | `202` with a non-sensitive delivery result |
| POST | `/auth/password-reset/confirm` | `{ "token", "password" }` | `200` with `{ "reset": true }` |
| POST | `/auth/mfa/enroll` | `{ "email", "password" }` | `201` with setup URI and one-time recovery codes |
| POST | `/auth/mfa/verify` | `{ "email", "password", "code" }` | `201` with an MFA-completed token pair |
| GET | `/.well-known/jwks.json` | none | `200` with a JWKS document |

Registration and password-reset request responses must not reveal whether an
email already exists. The local email adapter captures the generated link for
tests and local development; production responses do not include raw
verification or reset tokens.

MFA enrollment and completion are limited to verified Platform Admin
credentials. The enrollment response contains the setup secret and recovery
codes exactly once for local setup; they are not logged or returned again.
After successful verification, Platform Admin login requires either a current
TOTP code or one unused recovery code.

### 2.1 Token response

Login and refresh return:

```json
{
  "tokenType": "Bearer",
  "accessToken": "<signed-jwt>",
  "expiresIn": 900,
  "refreshToken": "<opaque-token>",
  "user": {
    "id": "user-customer-001",
    "email": "customer.r1@example.test",
    "roles": ["CUSTOMER"],
    "branchIds": []
  }
}
```

Refresh tokens are opaque, rotated, and never returned in logs or stored in
raw form.

### 2.2 Stable access-token claims

The signed JWT contains:

| Claim | Type | Meaning |
|---|---|---|
| `iss` | string | Configured Identity issuer |
| `aud` | string or string[] | Configured API audience |
| `sub` | string | Stable user ID |
| `iat` | number | Issued-at Unix timestamp |
| `exp` | number | Expiration Unix timestamp |
| `jti` | string | Unique token ID |
| `roles` | string[] | Assigned platform roles |
| `branch_ids` | string[] | Branches assigned to the user |
| `mfa_completed` | boolean | `true` only after successful Platform Admin TOTP verification |

`mfa_completed` is required for Gateway routes protected by Platform Admin
MFA. The `PLATFORM_ADMIN` role alone is not sufficient. Catalog independently
enforces authorization for privileged operations.

### 2.3 JWKS requirements

The JWKS response contains only public verification keys and uses the standard
`keys` array. Each active signing key has a stable `kid`, `kty`, `alg`, `use`,
and public RSA parameters. Private key material is never exposed.

## 3. Gateway authorization contract

The Gateway validates JWT signature, `iss`, `aud`, `exp`, and required claim
shape before forwarding a request. It does not query Identity for every
request.

| Route group | Gateway requirement | Owning-service enforcement |
|---|---|---|
| Identity registration, verification, login, refresh, reset | Public route with authentication rate limits | Identity validates input and token state |
| Identity logout | Valid refresh request | Identity revokes the token |
| Catalog discovery reads | Public unless the resource requires an authenticated user | Catalog validates resource visibility |
| Catalog manager operations | Authenticated `CINEMA_MANAGER` or `PLATFORM_ADMIN` | Catalog validates role, resource, and branch scope |
| Platform Admin protected operations | Authenticated `PLATFORM_ADMIN` and `mfa_completed: true` | Catalog or other owning service re-checks authorization |

The Gateway forwards the authenticated principal and correlation ID as
trusted internal request context. Direct public access to service listeners is
out of scope for R1.0.

## 4. Catalog read/write contract

R1 discovery responses expose stable identifiers and timestamps without
exposing service-internal database fields.

### 4.1 Movie

```json
{
  "id": "movie-now-showing-001",
  "title": "R1 Fixture Movie",
  "description": "Deterministic catalog fixture",
  "durationMinutes": 120,
  "genre": "DRAMA",
  "ageRating": "T13",
  "posterUrl": "https://example.test/movies/movie-now-showing-001/poster",
  "trailerUrl": "https://example.test/movies/movie-now-showing-001/trailer",
  "status": "NOW_SHOWING"
}
```

Movie status values are `COMING_SOON`, `NOW_SHOWING`, and `ENDED`.

### 4.2 Cinema, branch, screen, and layout

Discovery resources use the following references:

```json
{
  "cinemaId": "cinema-r1-001",
  "branchId": "branch-r1-hcm-001",
  "screenId": "screen-r1-001",
  "screenName": "Screen 1",
  "capacity": 4,
  "layoutVersion": 1,
  "seats": [
    { "id": "seat-r1-a1", "label": "A1", "type": "STANDARD", "row": "A", "number": 1 },
    { "id": "seat-r1-a2", "label": "A2", "type": "STANDARD", "row": "A", "number": 2 },
    { "id": "seat-r1-b1", "label": "B1", "type": "VIP", "row": "B", "number": 1 },
    { "id": "seat-r1-b2", "label": "B2", "type": "COUPLE", "row": "B", "number": 2 }
  ]
}
```

Seat types are `STANDARD`, `VIP`, and `COUPLE`. Couple-seat selection rules
remain deferred and are not implied by this read contract.

### 4.3 Showtime

```json
{
  "id": "showtime-r1-open-001",
  "movieId": "movie-now-showing-001",
  "branchId": "branch-r1-hcm-001",
  "screenId": "screen-r1-001",
  "startAt": "2030-01-15T12:00:00Z",
  "endAt": "2030-01-15T14:00:00Z",
  "saleOpensAt": "2030-01-01T00:00:00Z",
  "reservationCutoffAt": "2030-01-15T11:45:00Z",
  "status": "PUBLISHED",
  "discoveryVisible": true,
  "bookingEligible": true,
  "prices": {
    "STANDARD": 90000,
    "VIP": 120000,
    "COUPLE": 180000
  }
}
```

All timestamp fields represent UTC instants. `reservationCutoffAt` is derived
as 15 minutes before `startAt`; it is separate from configurable
`saleOpensAt`. A published showtime may be discovery-visible before
`saleOpensAt`, while `bookingEligible` requires publication, an open sale
window, and a current time before the reservation cutoff. Booking remains the
final authority for reservation eligibility in R2.

## 5. `ShowtimePublished` event contract

Catalog publishes the following versioned envelope through its Transactional
Outbox:

```json
{
  "eventId": "event-showtime-published-001",
  "eventType": "ShowtimePublished",
  "schemaVersion": 1,
  "aggregateType": "Showtime",
  "aggregateId": "showtime-r1-open-001",
  "occurredAt": "2030-01-01T00:00:00Z",
  "correlationId": "corr-01J00000000000000000000000",
  "payload": {
    "showtimeId": "showtime-r1-open-001",
    "movieId": "movie-now-showing-001",
    "branchId": "branch-r1-hcm-001",
    "screenId": "screen-r1-001",
    "startAt": "2030-01-15T12:00:00Z",
    "endAt": "2030-01-15T14:00:00Z",
    "saleOpensAt": "2030-01-01T00:00:00Z",
    "reservationCutoffAt": "2030-01-15T11:45:00Z",
    "prices": {
      "STANDARD": 90000,
      "VIP": 120000,
      "COUPLE": 180000
    }
  }
}
```

`eventId` is globally unique and remains stable across publication retries.
Consumers use `eventId` for deduplication and `aggregateId` for aggregate
ordering. The event does not contain customer data, authentication material,
or runtime seat inventory.

## 6. Provider-neutral email delivery boundary

Identity calls a provider-neutral port rather than a concrete email SDK:

```text
sendVerificationEmail({
  messageId,
  recipient,
  verificationLink,
  expiresAt
}) -> DeliveryAccepted { messageId }

sendPasswordResetEmail({
  messageId,
  recipient,
  resetLink,
  expiresAt
}) -> DeliveryAccepted { messageId }
```

The port reports accepted delivery or an explicit failure. It does not expose
raw tokens in logs. The local adapter stores the last message per `messageId`
in memory for automated tests and local development, and provides a test-only
inspection helper. It is not a production delivery mechanism and is not
implemented as a database-token lookup.

Open implementation decisions for R1.1 are limited to link base URL,
message-template wording, and the concrete production provider selected after
R1.

## 7. Fixture usage

Deterministic fixtures are stored under
`backend/test/fixtures/r1/`. They are intended for contract tests and local
development only. Fixture IDs are stable; tests must create and remove their
data explicitly and must not rely on a developer's persistent database volume.
