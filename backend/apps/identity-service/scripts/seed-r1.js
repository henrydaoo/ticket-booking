const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { randomBytes, scrypt: callbackScrypt } = require('node:crypto');
const { config: loadDotenv } = require('dotenv');
const { Client } = require('pg');

loadDotenv({ path: path.join(__dirname, '../.env') });

const scrypt = promisify(callbackScrypt);
const fixturePath = path.join(__dirname, '../../../test/fixtures/r1/identity.json');
const adminMfaSecret = 'JBSWY3DPEHPK3PXP';

const userIds = {
  'user-customer-001': '00000000-0000-4000-8000-000000000001',
  'user-manager-001': '00000000-0000-4000-8000-000000000002',
  'user-admin-001': '00000000-0000-4000-8000-000000000003',
  'user-admin-mfa-pending-001': '00000000-0000-4000-8000-000000000004',
  'user-staff-001': '00000000-0000-4000-8000-000000000005',
};

const branchIds = {
  'branch-r1-hcm-001': '10000000-0000-4000-8000-000000000001',
  'branch-r1-dn-001': '10000000-0000-4000-8000-000000000002',
};

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = Buffer.from(await scrypt(password, salt, 64));
  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

async function seed() {
  const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'));
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  await client.connect();
  try {
    await client.query('BEGIN');
    for (const user of fixture.users) {
      const userId = userIds[user.id];
      if (!userId) {
        throw new Error(`No deterministic UUID mapping for ${user.id}`);
      }

      const passwordHash = await hashPassword(user.password);
      await client.query(
        'DELETE FROM users WHERE id = $1 OR email = $2',
        [userId, user.email],
      );
      await client.query(
        `INSERT INTO users (id, email, password_hash, email_verified_at, mfa_enabled, mfa_secret)
         VALUES ($1, $2, $3, CASE WHEN $4 THEN NOW() ELSE NULL END, $5, $6)
         ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             password_hash = EXCLUDED.password_hash,
             email_verified_at = EXCLUDED.email_verified_at,
             mfa_enabled = EXCLUDED.mfa_enabled,
             mfa_secret = EXCLUDED.mfa_secret,
             updated_at = NOW()`,
        [
          userId,
          user.email,
          passwordHash,
          user.emailVerified,
          user.id === 'user-admin-001',
          user.id === 'user-admin-001' ? adminMfaSecret : null,
        ],
      );

      await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
      for (const role of user.roles) {
        await client.query(
          'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
          [userId, role],
        );
      }

      await client.query('DELETE FROM user_branch_assignments WHERE user_id = $1', [userId]);
      for (const branchId of user.branchIds) {
        const mappedBranchId = branchIds[branchId];
        if (!mappedBranchId) {
          throw new Error(`No deterministic UUID mapping for ${branchId}`);
        }
        await client.query(
          'INSERT INTO user_branch_assignments (user_id, branch_id) VALUES ($1, $2)',
          [userId, mappedBranchId],
        );
      }
    }

    await client.query('COMMIT');
    console.log(`Seeded ${fixture.users.length} Identity users.`);
    console.log(`Platform Admin TOTP secret: ${adminMfaSecret}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
