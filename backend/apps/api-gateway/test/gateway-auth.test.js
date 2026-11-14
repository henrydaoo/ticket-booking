const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const test = require('node:test');
const {
  ExecutionContext,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} = require('@nestjs/common');
const { JwtVerifierService } = require('../dist/modules/auth/jwt-verifier.service.js');
const { AuthGuard } = require('../dist/modules/auth/auth.guard.js');
const { RolesGuard } = require('../dist/modules/auth/roles.guard.js');
const { RateLimitGuard } = require('../dist/common/rate-limit.guard.js');

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
const config = {
  jwtIssuer: 'cinema-booking-identity',
  jwtAudience: 'cinema-booking-api',
};

function token(overrides = {}, headerOverrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: 'test-key', ...headerOverrides };
  const payload = {
    sub: 'user-001',
    iss: config.jwtIssuer,
    aud: config.jwtAudience,
    iat: now - 1,
    exp: now + 300,
    jti: 'token-001',
    roles: ['CUSTOMER'],
    branch_ids: [],
    mfa_completed: false,
    ...overrides,
  };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const input = `${encode(header)}.${encode(payload)}`;
  const signature = sign('RSA-SHA256', Buffer.from(input), privateKey);
  return `${input}.${signature.toString('base64url')}`;
}

function verifier() {
  return new JwtVerifierService(
    { getKey: async () => jwk },
    config,
  );
}

function requestContext(principal) {
  const request = { header: () => undefined };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  };
  return { request, context, principal };
}

test('valid JWT is verified and required claims are mapped', async () => {
  const result = await verifier().verify(`Bearer ${token()}`);

  assert.equal(result.principal.sub, 'user-001');
  assert.deepEqual(result.principal.roles, ['CUSTOMER']);
  assert.equal(result.principal.mfaCompleted, false);
});

test('missing, malformed, expired, wrong issuer and wrong audience tokens are rejected', async () => {
  const service = verifier();
  const cases = [
    undefined,
    'Bearer malformed',
    `Bearer ${token({ exp: Math.floor(Date.now() / 1000) - 1 })}`,
    `Bearer ${token({ iss: 'wrong-issuer' })}`,
    `Bearer ${token({ aud: 'wrong-audience' })}`,
  ];

  for (const authorization of cases) {
    await assert.rejects(
      () => service.verify(authorization),
      (error) => error instanceof UnauthorizedException,
    );
  }
});

test('invalid signature is rejected', async () => {
  const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const valid = token();
  const parts = valid.split('.');
  const forgedSignature = sign(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    otherKey,
  );

  await assert.rejects(
    () => verifier().verify(`${parts[0]}.${parts[1]}.${forgedSignature.toString('base64url')}`),
    (error) => error instanceof UnauthorizedException,
  );
});

test('platform admin MFA guard rejects role without completed MFA', async () => {
  const { request, context } = requestContext();
  const principal = {
    roles: ['PLATFORM_ADMIN'],
    mfaCompleted: false,
  };
  await new AuthGuard({
    verify: async () => ({ principal }),
  }).canActivate(context);
  const reflector = {
    getAllAndOverride: (key) => key === 'require_mfa',
  };
  const guard = new RolesGuard(reflector);

  assert.throws(() => guard.canActivate(context), ForbiddenException);
});

test('rate limit guard rejects requests after the configured threshold', () => {
  const guard = new RateLimitGuard({
    rateLimitWindowSeconds: 60,
    rateLimitMaxRequests: 1,
  });
  const request = { ip: '127.0.0.1', method: 'POST', path: '/auth/login' };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  };

  assert.equal(guard.canActivate(context), true);
  assert.throws(
    () => guard.canActivate(context),
    (error) => error instanceof HttpException && error.getStatus() === 429,
  );
});
