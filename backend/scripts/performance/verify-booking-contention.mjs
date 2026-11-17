import { Client } from 'pg';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assertTestDatabase(url) {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!database.endsWith('_test') || database === 'booking_db') {
    throw new Error('BOOKING_TEST_DATABASE_URL must target an isolated *_test database');
  }
  if (required('PERF_TEST_DATABASE_CONFIRM') !== database) {
    throw new Error('PERF_TEST_DATABASE_CONFIRM must equal the database name');
  }
}

async function main() {
  const databaseUrl = required('BOOKING_TEST_DATABASE_URL');
  assertTestDatabase(databaseUrl);
  const showtimeId = required('PERF_SHOWTIME_ID');
  const seatId = required('PERF_SEAT_ID');
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    const result = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('ACTIVE', 'PAYMENT_PENDING', 'CONFIRMED'))::int AS active_reservations,
         COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked_inventory,
         COUNT(*) FILTER (WHERE status IN ('HELD', 'BOOKED'))::int AS assigned_inventory
       FROM showtime_seats
       WHERE showtime_id = $1 AND seat_id = $2`,
      [showtimeId, seatId],
    );
    const row = result.rows[0];
    if (row.active_reservations > 1 || row.booked_inventory > 1 || row.assigned_inventory > 1) {
      throw new Error(`Contention invariant failed: ${JSON.stringify(row)}`);
    }
    console.log(JSON.stringify({ result: 'Passed', showtimeId, seatId, ...row }));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
