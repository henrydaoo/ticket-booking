import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { TransactionRunner } from '../../infrastructure/database/transaction.runner';

export type IdentityUser = {
  id: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
  mfa_enabled: boolean;
  mfa_secret: string | null;
  mfa_pending_secret: string | null;
};

export type RefreshSession = IdentityUser & {
  refresh_token_id: string;
  mfa_completed: boolean;
};

@Injectable()
export class IdentityRepository {
  constructor(
    @Inject(Pool) private readonly database: Pool,
    private readonly transactions: TransactionRunner,
  ) {}

  async registerUser(input: {
    userId: string;
    email: string;
    passwordHash: string;
    verificationTokenHash: string;
  }): Promise<void> {
    await this.transactions.run(async (client) => {
      await client.query(
        `INSERT INTO users (id, email, password_hash)
         VALUES ($1, $2, $3)`,
        [input.userId, input.email, input.passwordHash],
      );
      await client.query(
        `INSERT INTO user_roles (user_id, role)
         VALUES ($1, 'CUSTOMER')`,
        [input.userId],
      );
      await client.query(
        `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
        [input.userId, input.verificationTokenHash],
      );
    });
  }

  async verifyEmail(tokenHash: string): Promise<boolean> {
    return this.transactions.run(async (client) => {
      const result = await client.query<{ user_id: string }>(
        `UPDATE email_verification_tokens
         SET used_at = NOW()
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         RETURNING user_id`,
        [tokenHash],
      );

      if (result.rowCount !== 1) {
        return false;
      }

      await client.query(
        'UPDATE users SET email_verified_at = NOW(), updated_at = NOW() WHERE id = $1',
        [result.rows[0].user_id],
      );
      return true;
    });
  }

  async findUserByEmail(email: string): Promise<IdentityUser | undefined> {
    const result = await this.database.query<IdentityUser>(
      `SELECT id, email, password_hash, email_verified_at,
              mfa_enabled, mfa_secret, mfa_pending_secret
       FROM users
       WHERE email = $1`,
      [email],
    );
    return result.rows[0];
  }

  async findRefreshSession(tokenHash: string): Promise<RefreshSession | undefined> {
    const result = await this.database.query<RefreshSession>(
      `SELECT u.id, u.email, u.password_hash, u.email_verified_at,
              u.mfa_enabled, u.mfa_secret, u.mfa_pending_secret,
              r.id AS refresh_token_id, r.mfa_completed
       FROM refresh_tokens r
       JOIN users u ON u.id = r.user_id
       WHERE r.token_hash = $1
         AND r.revoked_at IS NULL
         AND r.expires_at > NOW()`,
      [tokenHash],
    );
    return result.rows[0];
  }

  async rolesForUser(userId: string): Promise<string[]> {
    const result = await this.database.query<{ role: string }>(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [userId],
    );
    return result.rows.map((row) => row.role);
  }

  async branchIdsForUser(userId: string): Promise<string[]> {
    const result = await this.database.query<{ branch_id: string }>(
      'SELECT branch_id FROM user_branch_assignments WHERE user_id = $1',
      [userId],
    );
    return result.rows.map((row) => row.branch_id);
  }

  async createRefreshToken(input: {
    id: string;
    userId: string;
    tokenHash: string;
    ttlSeconds: number;
    mfaCompleted: boolean;
  }): Promise<void> {
    await this.database.query(
      `INSERT INTO refresh_tokens
        (id, user_id, token_hash, expires_at, mfa_completed)
       VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 second'), $5)`,
      [
        input.id,
        input.userId,
        input.tokenHash,
        input.ttlSeconds,
        input.mfaCompleted,
      ],
    );
  }

  async rotateRefreshToken(input: {
    oldTokenId: string;
    newTokenId: string;
    userId: string;
    tokenHash: string;
    ttlSeconds: number;
    mfaCompleted: boolean;
  }): Promise<void> {
    await this.transactions.run(async (client) => {
      await this.insertRefreshToken(client, input);
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = $1 WHERE id = $2',
        [input.newTokenId, input.oldTokenId],
      );
    });
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.database.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
      [tokenHash],
    );
  }

  async createPasswordResetToken(
    userId: string,
    resetTokenHash: string,
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [userId, resetTokenHash],
    );
  }

  async resetPassword(
    resetTokenHash: string,
    passwordHash: string,
  ): Promise<boolean> {
    return this.transactions.run(async (client) => {
      const result = await client.query<{ user_id: string }>(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
         RETURNING user_id`,
        [resetTokenHash],
      );

      if (result.rowCount !== 1) {
        return false;
      }

      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [passwordHash, result.rows[0].user_id],
      );
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL',
        [result.rows[0].user_id],
      );
      return true;
    });
  }

  async startMfaEnrollment(input: {
    userId: string;
    secret: string;
    recoveryCodeHashes: string[];
  }): Promise<void> {
    await this.transactions.run(async (client) => {
      await client.query(
        `UPDATE users
         SET mfa_pending_secret = $1, updated_at = NOW()
         WHERE id = $2`,
        [input.secret, input.userId],
      );
      await client.query(
        'DELETE FROM mfa_recovery_codes WHERE user_id = $1 AND used_at IS NULL',
        [input.userId],
      );
      for (const recoveryCodeHash of input.recoveryCodeHashes) {
        await client.query(
          `INSERT INTO mfa_recovery_codes (user_id, code_hash)
           VALUES ($1, $2)`,
          [input.userId, recoveryCodeHash],
        );
      }
      await this.addAuditRecord(client, input.userId, 'MFA_ENROLLMENT_STARTED');
    });
  }

  async completeMfaEnrollment(userId: string): Promise<void> {
    await this.transactions.run(async (client) => {
      await client.query(
        `UPDATE users
         SET mfa_secret = mfa_pending_secret,
             mfa_pending_secret = NULL,
             mfa_enabled = TRUE,
             mfa_enrolled_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [userId],
      );
      await this.addAuditRecord(client, userId, 'MFA_ENROLLMENT_COMPLETED');
    });
  }

  async consumeRecoveryCode(userId: string, recoveryCodeHash: string): Promise<boolean> {
    return this.transactions.run(async (client) => {
      const result = await client.query<{ id: string }>(
        `SELECT id
         FROM mfa_recovery_codes
         WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
         FOR UPDATE`,
        [userId, recoveryCodeHash],
      );
      if (result.rowCount !== 1) {
        return false;
      }
      await client.query(
        'UPDATE mfa_recovery_codes SET used_at = NOW() WHERE id = $1',
        [result.rows[0].id],
      );
      return true;
    });
  }

  async addAuditRecord(
    client: PoolClient | undefined,
    userId: string,
    action: string,
  ): Promise<void> {
    const executor = client ?? this.database;
    await executor.query(
      `INSERT INTO identity_audit_logs (actor_user_id, action, target_user_id)
       VALUES ($1, $2, $1)`,
      [userId, action],
    );
  }

  private async insertRefreshToken(
    client: PoolClient,
    input: {
      newTokenId: string;
      userId: string;
      tokenHash: string;
      ttlSeconds: number;
      mfaCompleted: boolean;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO refresh_tokens
        (id, user_id, token_hash, expires_at, mfa_completed)
       VALUES ($1, $2, $3, NOW() + ($4 * INTERVAL '1 second'), $5)`,
      [
        input.newTokenId,
        input.userId,
        input.tokenHash,
        input.ttlSeconds,
        input.mfaCompleted,
      ],
    );
  }
}
