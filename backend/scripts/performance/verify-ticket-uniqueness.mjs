import { Client } from 'pg';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const databaseUrl = required('TICKET_TEST_DATABASE_URL');
  const parsed = new URL(databaseUrl);
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!database.endsWith('_test') || database === 'ticket_db') {
    throw new Error('TICKET_TEST_DATABASE_URL must target an isolated *_test database');
  }
  if (required('PERF_TEST_DATABASE_CONFIRM') !== database) {
    throw new Error('PERF_TEST_DATABASE_CONFIRM must equal the database name');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const duplicateSeats = await client.query(
      `SELECT booking_id, COUNT(*)::int AS ticket_count
       FROM tickets
       WHERE booking_id = $1
       GROUP BY booking_id
       HAVING COUNT(*) > COUNT(DISTINCT seat_id)`,
      [required('PERF_BOOKING_ID')],
    );
    if (duplicateSeats.rowCount > 0) {
      throw new Error(`Duplicate ticket invariant failed: ${JSON.stringify(duplicateSeats.rows)}`);
    }
    console.log(JSON.stringify({ result: 'Passed', bookingId: process.env.PERF_BOOKING_ID }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
