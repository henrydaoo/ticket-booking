import { Client } from 'pg';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const databaseUrl = required('TICKET_TEST_DATABASE_URL');
  const database = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\/+/, ''));
  if (!database.endsWith('_test') || database === 'ticket_db') {
    throw new Error('TICKET_TEST_DATABASE_URL must target an isolated *_test database');
  }
  if (required('PERF_TEST_DATABASE_CONFIRM') !== database) {
    throw new Error('PERF_TEST_DATABASE_CONFIRM must equal the database name');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const duplicateCheckIns = await client.query(
      `SELECT ticket_id, COUNT(*) FILTER (WHERE reversed_at IS NULL)::int AS successful_check_ins
       FROM ticket_check_ins
       WHERE ticket_id = $1
       GROUP BY ticket_id
       HAVING COUNT(*) FILTER (WHERE reversed_at IS NULL) > 1`,
      [required('PERF_TICKET_ID')],
    );
    if (duplicateCheckIns.rowCount > 0) {
      throw new Error(`Duplicate check-in invariant failed: ${JSON.stringify(duplicateCheckIns.rows)}`);
    }
    console.log(JSON.stringify({ result: 'Passed', ticketId: process.env.PERF_TICKET_ID }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
