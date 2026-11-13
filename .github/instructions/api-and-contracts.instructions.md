---
applyTo: "**/*.{ts,tsx,js,json,md}"
---

# API and contract guidance

- Use the approved contract documents in `docs/` before changing a request,
  response, event, or error shape.
- Keep public request DTOs, response types, status codes, error codes, and
  event envelopes explicit and stable.
- Reject invalid input at the boundary and return safe errors without
  credentials, raw tokens, stack traces, or internal SQL details.
- Preserve correlation IDs across Gateway and service boundaries.
- Do not expose service-internal database fields through public responses.
- Use versioning or an approved contract change process when compatibility is
  affected; do not silently change existing behavior.
- When refactoring, verify that routes, status codes, response and error shapes,
  authorization, and event contracts remain unchanged unless a contract change
  has been explicitly approved.
- Do not create an API endpoint or event merely because it may be useful later.
