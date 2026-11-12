---
applyTo: "**/*.{ts,tsx,js,sql,json}"
---

# Security guidance

- Validate and normalize untrusted input at service boundaries.
- Enforce authorization in the owning service; Gateway and frontend checks are
  not substitutes for resource or branch-scope authorization.
- Validate JWT signature, issuer, audience, expiry, and required claims where
  the approved boundary requires it.
- Treat `PLATFORM_ADMIN` role and completed MFA as separate conditions.
- Hash passwords, refresh tokens, and one-time recovery material using the
  approved implementation. Never log or persist raw secrets.
- Prevent account-enumeration leaks in registration and password-reset flows.
- Use safe error responses and preserve useful server-side failure context
  without exposing sensitive data.
- Review replay, rotation, revocation, rate limiting, injection, and
  privilege-escalation scenarios for authentication changes.
