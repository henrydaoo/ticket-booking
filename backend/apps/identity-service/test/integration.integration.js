const assert = require('node:assert/strict');
const { createHash, randomUUID } = require('node:crypto');
const path = require('node:path');
const test = require('node:test');
const { config: loadDotenv } = require('dotenv');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { Pool } = require('pg');

loadDotenv({ path: path.join(__dirname, '../.env') });

const { IdentityModule } = require('../dist/app.module.js');
const {
  LocalEmailDeliveryAdapter,
} = require('../dist/infrastructure/email/local-email-delivery.adapter.js');
const { TotpService } = require('../dist/modules/auth/totp.service.js');

const password = 'Password123!';
const email = `r1-integration-${randomUUID()}@example.test`;
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

let app;
let database;
let emailDelivery;
let baseUrl;

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });
  const text = await response.text();

  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
  };
}

function accessTokenPayload(accessToken) {
  return JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString());
}

test.before(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is required. Start the controlled Identity PostgreSQL instance and run pnpm run migrate first.',
    );
  }

  app = await NestFactory.create(IdentityModule, { logger: false });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  await app.listen(0, '127.0.0.1');

  const address = app.getHttpServer().address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  database = app.get(Pool);
  emailDelivery = app.get(LocalEmailDeliveryAdapter);
});

test.after(async () => {
  if (database) {
    await database.query(
      `DELETE FROM identity_audit_logs
       WHERE actor_user_id IN (SELECT id FROM users WHERE email = $1)
          OR target_user_id IN (SELECT id FROM users WHERE email = $1)`,
      [email],
    );
    await database.query('DELETE FROM users WHERE email = $1', [email]);
    await database.end();
  }
  if (app) {
    await app.close();
  }
});

test('R1.1 identity lifecycle enforces verification, rotation, reset, MFA, and JWKS', async () => {
  const registered = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  assert.equal(registered.status, 201);
  assert.equal(registered.body.emailVerified, false);
  assert.equal(registered.body.email, email);
  assert.equal('password' in registered.body, false);

  const storedUser = await database.query(
    'SELECT password_hash FROM users WHERE email = $1',
    [email],
  );
  assert.equal(storedUser.rowCount, 1);
  assert.notEqual(storedUser.rows[0].password_hash, password);

  const verificationMessage = emailDelivery.getMessage(
    registered.body.verificationDelivery.messageId,
  );
  assert.ok(verificationMessage);
  const verificationToken = new URL(
    verificationMessage.verificationLink,
  ).searchParams.get('token');
  assert.ok(verificationToken);

  const unverifiedLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(unverifiedLogin.status, 401);

  const verified = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: verificationToken }),
  });
  assert.deepEqual(verified, {
    status: 201,
    body: { verified: true },
  });

  const reusedVerification = await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: verificationToken }),
  });
  assert.equal(reusedVerification.status, 401);

  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  assert.equal(
    accessTokenPayload(login.body.accessToken).mfa_completed,
    false,
  );

  const storedRefresh = await database.query(
    'SELECT token_hash FROM refresh_tokens WHERE user_id = $1',
    [registered.body.userId],
  );
  assert.equal(storedRefresh.rows.some((row) => row.token_hash === login.body.refreshToken), false);
  assert.equal(storedRefresh.rows[0].token_hash, tokenHash(login.body.refreshToken));

  const rotated = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: login.body.refreshToken }),
  });
  assert.equal(rotated.status, 201);

  const reusedRefresh = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: login.body.refreshToken }),
  });
  assert.equal(reusedRefresh.status, 401);

  const loggedOut = await request('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: rotated.body.refreshToken }),
  });
  assert.deepEqual(loggedOut, {
    status: 200,
    body: { revoked: true },
  });

  const revokedRefresh = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: rotated.body.refreshToken }),
  });
  assert.equal(revokedRefresh.status, 401);

  const resetCandidate = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert.equal(resetCandidate.status, 200);

  const resetRequested = await request('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  assert.equal(resetRequested.status, 202);
  const resetMessage = emailDelivery.getMessage(
    resetRequested.body.delivery.messageId,
  );
  const resetToken = new URL(resetMessage.resetLink).searchParams.get('token');

  const reset = await request('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token: resetToken, password: 'NewPassword123!' }),
  });
  assert.deepEqual(reset, {
    status: 201,
    body: { reset: true },
  });

  const invalidatedByReset = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: resetCandidate.body.refreshToken }),
  });
  assert.equal(invalidatedByReset.status, 401);

  await database.query(
    `INSERT INTO user_roles (user_id, role)
     VALUES ($1, 'PLATFORM_ADMIN')`,
    [registered.body.userId],
  );

  const enrollment = await request('/auth/mfa/enroll', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'NewPassword123!' }),
  });
  assert.equal(enrollment.status, 201);
  assert.equal(enrollment.body.mfaEnabled, false);
  assert.equal(enrollment.body.recoveryCodes.length, 8);

  const totp = new TotpService();
  const mfaCode = totp.generateCode(enrollment.body.secret);
  const mfaCompletion = await request('/auth/mfa/verify', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'NewPassword123!',
      code: mfaCode,
    }),
  });
  assert.equal(mfaCompletion.status, 201);
  assert.equal(
    accessTokenPayload(mfaCompletion.body.accessToken).mfa_completed,
    true,
  );

  const mfaRequired = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'NewPassword123!' }),
  });
  assert.equal(mfaRequired.status, 401);

  const recoveryLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'NewPassword123!',
      recoveryCode: enrollment.body.recoveryCodes[0],
    }),
  });
  assert.equal(recoveryLogin.status, 200);
  assert.equal(
    accessTokenPayload(recoveryLogin.body.accessToken).mfa_completed,
    true,
  );

  const reusedRecoveryCode = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'NewPassword123!',
      recoveryCode: enrollment.body.recoveryCodes[0],
    }),
  });
  assert.equal(reusedRecoveryCode.status, 401);

  const jwks = await request('/.well-known/jwks.json', {
    method: 'GET',
    headers: {},
  });
  assert.equal(jwks.status, 200);
  assert.equal(jwks.body.keys[0].kty, 'RSA');
  assert.equal(jwks.body.keys[0].alg, 'RS256');
});
