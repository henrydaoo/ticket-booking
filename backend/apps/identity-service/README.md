# Identity Service

Identity Service is an independently startable NestJS application and the only service configured with `identity_db` credentials.

## Local setup

Copy `.env.example` to `.env`, generate development JWT keys, and apply the
identity migration:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\backend\apps\identity-service
Copy-Item .env.example .env
pnpm run keys:generate
pnpm run migrate
```

The generated `dev-keys/` directory is ignored and must never be committed.

To load the deterministic R1 accounts for local UI and Gateway verification,
run the explicit seed from the backend workspace:

```powershell
Set-Location D:\beandrew\developer\ticket-booking\backend
pnpm seed:r1
```

The seed reads the test-only accounts from
`backend/test/fixtures/r1/identity.json`, is safe to rerun, and prints the
test-only Platform Admin TOTP secret. It must only be used with local
development databases.

## Authentication boundaries

- `POST /auth/register`
- `POST /auth/verify-email`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/confirm`
- `POST /auth/mfa/enroll`
- `POST /auth/mfa/verify`
- `GET /.well-known/jwks.json`

The local email adapter captures verification and password-reset links for
local development and automated tests. Raw tokens are not returned in HTTP
responses.

Production deployments must set `EMAIL_DELIVERY_MODE=smtp` and provide the
SMTP variables in `.env` or the deployment secret manager. Missing SMTP
configuration fails startup; it never silently falls back to local delivery.

Access tokens are signed with the configured RSA private key. Refresh tokens
are stored only as SHA-256 hashes and are rotated on refresh. Email
verification, password reset, and refresh-token state are owned by
`identity_db`. Platform Admin MFA uses TOTP with one-time recovery codes, and
the JWT `mfa_completed` claim is true only after successful MFA verification.

