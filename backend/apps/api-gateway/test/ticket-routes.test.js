const assert = require('node:assert/strict');
const test = require('node:test');
const { AuthGuard } = require('../dist/modules/auth/auth.guard.js');
const { TicketController } = require('../dist/modules/ticket/ticket.controller.js');
const { loadGatewayConfig } = require('../dist/config.js');

test('Gateway configuration requires and normalizes the Ticket Service URL', () => {
  const config = loadGatewayConfig({
    SERVICE_NAME: 'api-gateway',
    PORT: '3000',
    IDENTITY_SERVICE_URL: 'http://localhost:3001',
    IDENTITY_JWKS_URL: 'http://localhost:3001/.well-known/jwks.json',
    CATALOG_SERVICE_URL: 'http://localhost:3002',
    BOOKING_SERVICE_URL: 'http://localhost:3003',
    PAYMENT_SERVICE_URL: 'http://localhost:3004',
    TICKET_SERVICE_URL: 'http://localhost:3005/',
    JWT_ISSUER: 'issuer',
    JWT_AUDIENCE: 'audience',
  });

  assert.equal(config.ticketServiceUrl, 'http://localhost:3005');
});

function authContext(request) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

test('ticket list forwards the authenticated principal and correlation ID', async () => {
  const calls = [];
  const controller = new TicketController({
    list: async (...args) => {
      calls.push(args);
      return [];
    },
  });
  const request = { header: () => 'Bearer test-token' };
  const principal = {
    sub: 'customer-001',
    roles: ['CUSTOMER'],
    branchIds: [],
    mfaCompleted: false,
    issuer: 'issuer',
    audience: 'audience',
    issuedAt: 1,
    expiresAt: 2,
    tokenId: 'token-001',
  };

  await new AuthGuard({
    verify: async () => ({ principal }),
  }).canActivate(authContext(request));
  await controller.list(request, 'correlation-001');

  assert.deepEqual(calls, [['correlation-001', principal]]);
});
