import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('frontend foundation contains modular route groups and boundaries', () => {
  for (const relativePath of [
    'src/app/(public)/page.tsx',
    'src/app/(customer)/account/page.tsx',
    'src/app/(staff)/staff/page.tsx',
    'src/app/(admin)/admin/page.tsx',
    'src/lib/api-client/client.ts',
    'src/lib/auth/auth-boundary.ts',
    'src/components/auth/protected-route.tsx',
  ]) {
    assert.equal(fs.existsSync(path.join(frontendRoot, relativePath)), true, relativePath);
  }
});

test('frontend source does not reference backend implementation paths', () => {
  const source = fs.readFileSync(
    path.join(frontendRoot, 'src/lib/api-client/client.ts'),
    'utf8',
  );
  assert.equal(source.includes('backend/'), false);
  assert.equal(source.includes('postgres'), false);
});
