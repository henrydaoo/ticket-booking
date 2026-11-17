CREATE TABLE IF NOT EXISTS notification_dlq_replays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES notification_jobs(id),
  replayed_by TEXT NOT NULL,
  replayed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS notification_dlq_replays_job_idx
  ON notification_dlq_replays (job_id, replayed_at DESC);
