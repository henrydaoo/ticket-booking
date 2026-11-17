import { spawn } from 'node:child_process';
import { Client } from 'pg';

const migrationDefinitions = {
  identity: {
    databaseName: 'identity_db',
    packageName: '@ticket-booking/identity-service',
  },
  catalog: {
    databaseName: 'catalog_db',
    packageName: '@ticket-booking/catalog-service',
  },
  booking: {
    databaseName: 'booking_db',
    packageName: '@ticket-booking/booking-service',
  },
  payment: {
    databaseName: 'payment_db',
    packageName: '@ticket-booking/payment-service',
  },
  ticket: {
    databaseName: 'ticket_db',
    packageName: '@ticket-booking/ticket-service',
  },
  notification: {
    databaseName: 'notification_db',
    packageName: '@ticket-booking/notification-service',
  },
};

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for a migration job`);
  }
  return value;
}

function databaseNameFromUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!databaseName) {
    throw new Error('DATABASE_URL must include a database name');
  }
  return databaseName;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Migration command exited with ${code ?? signal}`));
    });
  });
}

async function main() {
  const service = required('MIGRATION_SERVICE');
  const definition = migrationDefinitions[service];
  if (!definition) {
    throw new Error(`Unsupported MIGRATION_SERVICE: ${service}`);
  }

  const databaseUrl = required('DATABASE_URL');
  const expectedDatabaseName = required('MIGRATION_DATABASE_NAME');
  const actualDatabaseName = databaseNameFromUrl(databaseUrl);

  if (expectedDatabaseName !== definition.databaseName) {
    throw new Error(
      `MIGRATION_DATABASE_NAME does not match ${service} migration definition`,
    );
  }
  if (actualDatabaseName !== expectedDatabaseName) {
    throw new Error(
      `Migration target mismatch: expected ${expectedDatabaseName}, received ${actualDatabaseName}`,
    );
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const lockKey = `ticket-booking:migration:${service}`;

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [lockKey]);
    console.log(
      JSON.stringify({
        event: 'migration_lock_acquired',
        service,
        database: actualDatabaseName,
        commit: process.env.GITHUB_SHA ?? 'local',
      }),
    );

    const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    await runCommand(pnpmCommand, [
      '--filter',
      definition.packageName,
      'run',
      'migrate',
    ]);
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]);
    await client.end();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      event: 'migration_failed',
      service: process.env.MIGRATION_SERVICE ?? 'unknown',
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});
