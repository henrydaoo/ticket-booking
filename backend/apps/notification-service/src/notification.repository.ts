import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { ClaimedNotificationJob, NotificationEvent, NotificationJobInput } from './notification.types';

@Injectable()
export class NotificationRepository {
  constructor(private readonly pool: Pool) {}

  async createJobs(event: NotificationEvent, jobs: NotificationJobInput[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const job of jobs) {
        await client.query(
          `INSERT INTO notification_jobs
             (event_id, notification_type, recipient_email, template_data,
              aggregate_id, correlation_id, scheduled_at)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
           ON CONFLICT (aggregate_id, notification_type) DO NOTHING`,
          [
            event.eventId,
            job.type,
            job.recipientEmail,
            JSON.stringify(job.templateData),
            event.aggregateId,
            event.correlationId,
            job.scheduledAt,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async claimNext(): Promise<ClaimedNotificationJob | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<ClaimedNotificationJob>(
        `WITH candidate AS (
           SELECT id
           FROM notification_jobs
           WHERE (status = 'PENDING' AND scheduled_at <= NOW() AND next_attempt_at <= NOW())
              OR (status = 'PROCESSING' AND lease_until < NOW())
           ORDER BY scheduled_at, id
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         UPDATE notification_jobs AS job
         SET status = 'PROCESSING',
             lease_until = NOW() + INTERVAL '30 seconds',
             attempt_count = attempt_count + 1
         FROM candidate
         WHERE job.id = candidate.id
         RETURNING job.id, job.notification_type AS type, job.recipient_email,
                   job.template_data, job.correlation_id, job.attempt_count`,
      );
      await client.query('COMMIT');
      return result.rows[0] ?? null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async markDelivered(job: ClaimedNotificationJob): Promise<void> {
    await this.pool.query(
      `UPDATE notification_jobs
       SET status = 'DELIVERED', delivered_at = NOW(), lease_until = NULL, last_error = NULL
       WHERE id = $1 AND status = 'PROCESSING'`,
      [job.id],
    );
  }

  async markFailed(job: ClaimedNotificationJob, errorMessage: string, retryable: boolean): Promise<void> {
    const deadLetter = !retryable || job.attemptCount >= 5;
    const retryDelaySeconds = Math.min(900, 2 ** Math.max(0, job.attemptCount - 1));
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO notification_delivery_attempts
           (job_id, attempt_number, outcome, error_message)
         VALUES ($1, $2, $3, $4)`,
        [job.id, job.attemptCount, deadLetter ? 'DEAD_LETTER' : 'RETRY', errorMessage.slice(0, 1000)],
      );
      await client.query(
        `UPDATE notification_jobs
         SET status = $2,
             next_attempt_at = CASE WHEN $2 = 'PENDING' THEN NOW() + make_interval(secs => $3) ELSE next_attempt_at END,
             lease_until = NULL,
             last_error = $4
         WHERE id = $1 AND status = 'PROCESSING'`,
        [job.id, deadLetter ? 'DEAD_LETTER' : 'PENDING', retryDelaySeconds, errorMessage.slice(0, 1000)],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
