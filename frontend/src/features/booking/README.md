# Booking feature boundary

R2.7 provides the customer booking flow:

- seat-map discovery and availability presentation;
- all-or-nothing reservation requests through the Gateway;
- backend-authoritative reservation expiry;
- booking creation and payment start;
- customer booking history.

The browser only stores presentation state such as selected seat IDs. Booking,
pricing, expiry, authorization, and payment outcomes remain backend-owned.
