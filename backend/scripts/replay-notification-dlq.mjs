import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';

loadDotenv();
const databaseUrl = process.env.NOTIFICATION_DATABASE_URL;
const confirmation = process.env.NOTIFICATION_DLQ_REPLAY_CONFIRM?.trim();
const replayedBy = process.env.NOTIFICATION_DLQ_REPLAYED_BY?.trim();
const reason = process.env.NOTIFICATION_DLQ_REPLAY_REASON?.trim();
if (!databaseUrl || !confirmation || !replayedBy || !reason) {
  throw new Error(
    'NOTIFICATION_DATABASE_URL, NOTIFICATION_DLQ_REPLAY_CONFIRM, ' +
      'NOTIFICATION_DLQ_REPLAYED_BY and NOTIFICATION_DLQ_REPLAY_REASON are required',
  );
}
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
if (confirmation !== `REPLAY:${databaseName}`) {
  throw new Error('NOTIFICATION_DLQ_REPLAY_CONFIRM must equal REPLAY:<database name>');
}
const jobId = process.env.NOTIFICATION_DLQ_JOB_ID?.trim() || null;
const client = new Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query('BEGIN');
  const result = await client.query(
    `WITH selected AS (
       SELECT id FROM notification_jobs
       WHERE status = 'DEAD_LETTER' AND ($1::uuid IS NULL OR id = $1::uuid)
       ORDER BY created_at, id
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE notification_jobs AS job
     SET status = 'PENDING',
         attempt_count = 0,
         next_attempt_at = NOW(),
         lease_until = NULL,
         last_error = NULL
     FROM selected
     WHERE job.id = selected.id
     RETURNING job.id`,
    [jobId],
  );
  if (result.rowCount !== 1) throw new Error('No matching DEAD_LETTER notification job found');
  const selectedJobId = result.rows[0].id;
  await client.query(
    `INSERT INTO notification_dlq_replays (job_id, replayed_by, reason)
     VALUES ($1, $2, $3)`,
    [selectedJobId, replayedBy, reason.slice(0, 500)],
  );
  await client.query('COMMIT');
  console.log(`Requeued notification job ${selectedJobId}.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
