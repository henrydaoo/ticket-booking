const assert = require('node:assert/strict');
const test = require('node:test');
const { AuthGuard } = require('../dist/modules/auth/auth.guard.js');
const { CatalogController } = require('../dist/modules/catalog/catalog.controller.js');

function authContext(request) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

test('showtime discovery preserves filters and correlation ID through the proxy', async () => {
  const calls = [];
  const controller = new CatalogController({
    forward: async (...args) => {
      calls.push(args);
      return [];
    },
  });
  const request = {
    originalUrl: '/catalog/showtimes?movieId=movie-1&from=2030-01-01T00%3A00%3A00Z',
  };

  await controller.showtimes(request, 'correlation-1');

  assert.deepEqual(calls, [[
    '/showtimes?movieId=movie-1&from=2030-01-01T00%3A00%3A00Z',
    'correlation-1',
  ]]);
});

test('publish route forwards the authenticated principal and correlation ID', async () => {
  const calls = [];
  const controller = new CatalogController({
    forward: async (...args) => {
      calls.push(args);
      return { status: 'PUBLISHED' };
    },
  });
  const request = {
    header: () => 'Bearer test-token',
    params: { showtimeId: 'showtime-1' },
  };
  const principal = {
    sub: 'manager-1',
    roles: ['CINEMA_MANAGER'],
    branchIds: ['branch-1'],
    mfaCompleted: false,
    issuer: 'issuer',
    audience: 'audience',
    issuedAt: 1,
    expiresAt: 2,
    tokenId: 'token-1',
  };
  await new AuthGuard({
    verify: async () => ({ principal }),
  }).canActivate(authContext(request));

  await controller.publishShowtime(request, {}, 'correlation-2');

  assert.deepEqual(calls, [[
    '/showtimes/showtime-1/publish',
    'correlation-2',
    principal,
    'POST',
    {},
  ]]);
});

test('draft discovery forwards an authenticated principal to Catalog', async () => {
  const calls = [];
  const controller = new CatalogController({
    forward: async (...args) => {
      calls.push(args);
      return [];
    },
  });
  const request = {
    header: () => 'Bearer test-token',
  };
  const principal = {
    sub: 'manager-1',
    roles: ['CINEMA_MANAGER'],
    branchIds: ['branch-1'],
    mfaCompleted: false,
    issuer: 'issuer',
    audience: 'audience',
    issuedAt: 1,
    expiresAt: 2,
    tokenId: 'token-1',
  };
  await new AuthGuard({
    verify: async () => ({ principal }),
  }).canActivate(authContext(request));

  await controller.draftShowtimes(request, 'correlation-3');

  assert.deepEqual(calls, [[
    '/showtimes/drafts',
    'correlation-3',
    principal,
  ]]);
});
