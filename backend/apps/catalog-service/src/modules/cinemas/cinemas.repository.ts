import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class CinemasRepository {
  constructor(@Inject(Pool) private readonly database: Pool) {}

  async listCinemas(): Promise<unknown[]> {
    const result = await this.database.query(
      'SELECT id, name FROM cinemas ORDER BY name ASC',
    );
    return result.rows;
  }

  async createCinema(id: string, name: string): Promise<unknown> {
    const result = await this.database.query(
      'INSERT INTO cinemas (id, name) VALUES ($1, $2) RETURNING id, name',
      [id, name],
    );
    return result.rows[0];
  }

  async listBranches(): Promise<unknown[]> {
    const result = await this.database.query(
      `SELECT id, cinema_id AS "cinemaId", name, address
       FROM branches ORDER BY name ASC`,
    );
    return result.rows;
  }

  async findBranch(branchId: string): Promise<{ id: string; cinema_id: string } | undefined> {
    const result = await this.database.query(
      'SELECT id, cinema_id FROM branches WHERE id = $1',
      [branchId],
    );
    return result.rows[0];
  }

  async createBranch(id: string, input: { cinemaId: string; name: string; address: string }): Promise<unknown> {
    const result = await this.database.query(
      `INSERT INTO branches (id, cinema_id, name, address)
       VALUES ($1, $2, $3, $4)
       RETURNING id, cinema_id AS "cinemaId", name, address`,
      [id, input.cinemaId, input.name, input.address],
    );
    return result.rows[0];
  }
}
