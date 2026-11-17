# Tickets

The customer ticket page reads issued tickets through the API Gateway and
displays the backend-owned status and QR token. Ticket issuance is driven by
`BookingConfirmed`; the frontend does not create tickets or decide validity.
Check-in and ticket cancellation remain separate backend-owned workflows.
