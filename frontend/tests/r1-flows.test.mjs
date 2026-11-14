import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8');
}

test('R1 authentication routes and Gateway operations are wired', () => {
  for (const relativePath of [
    'src/app/(auth)/login/page.tsx',
    'src/app/(auth)/register/page.tsx',
    'src/app/(auth)/verify-email/page.tsx',
    'src/app/(auth)/reset-password/page.tsx',
  ]) {
    assert.equal(fs.existsSync(path.join(frontendRoot, relativePath)), true, relativePath);
  }

  const authClient = read('src/lib/auth/auth-client.ts');
  for (const endpoint of [
    '/auth/register',
    '/auth/verify-email',
    '/auth/login',
    '/auth/refresh',
    '/auth/logout',
    '/auth/password-reset/request',
    '/auth/password-reset/confirm',
  ]) {
    assert.equal(authClient.includes(endpoint), true, endpoint);
  }
  assert.match(read('src/components/auth/auth-form.tsx'), /react-hook-form/);
  assert.match(read('src/components/auth/auth-form.tsx'), /zodResolver/);
});

test('registration and verification are discoverable from the auth form', () => {
  const authForm = read('src/components/auth/auth-form.tsx');
  assert.match(authForm, /href="\/register"/);
  assert.match(authForm, /href="\/login"/);
  assert.match(authForm, /window\.location\.search/);
});

test('R1 discovery modules expose the approved public Catalog reads', () => {
  const catalogClient = read('src/lib/catalog/catalog-client.ts');
  for (const endpoint of ['/catalog/movies', '/catalog/cinemas', '/catalog/branches', '/catalog/screens', '/catalog/showtimes']) {
    assert.equal(catalogClient.includes(endpoint), true, endpoint);
  }
});

test('Gateway-backed server state uses the shared TanStack Query provider', () => {
  assert.match(read('src/app/layout.tsx'), /QueryProvider/);
  assert.match(read('src/lib/catalog/catalog-queries.ts'), /useQuery/);
});
