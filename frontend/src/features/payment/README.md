# Payment feature boundary

R2.7 starts payments through the Gateway and redirects to the provider URL.
The return page polls the approved payment-status contract and never infers
success from browser query parameters.
