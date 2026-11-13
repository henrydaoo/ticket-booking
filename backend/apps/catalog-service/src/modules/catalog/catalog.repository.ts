import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { TransactionRunner } from '../../infrastructure/database/transaction.runner';
import { MovieStatus, SeatType } from './dto/catalog.dto';

type MovieInput = {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
  genre: string;
  ageRating: string;
  posterUrl: string;
  trailerUrl: string;
  status: MovieStatus;
};

@Injectable()
export class CatalogRepository {
  constructor(
    @Inject(Pool) private readonly database: Pool,
    private readonly transactions: TransactionRunner,
  ) {}

  async listMovies(search?: string, status?: MovieStatus): Promise<unknown[]> {
    const values: string[] = [];
    const conditions: string[] = [];
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(title ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }
    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.database.query(
      `SELECT id, title, description, duration_minutes AS "durationMinutes",
              genre, age_rating AS "ageRating", poster_url AS "posterUrl",
              trailer_url AS "trailerUrl", status
       FROM movies ${where} ORDER BY title ASC`,
      values,
    );
    return result.rows;
  }

  async createMovie(input: MovieInput): Promise<unknown> {
    const result = await this.database.query(
      `INSERT INTO movies
       (id, title, description, duration_minutes, genre, age_rating, poster_url, trailer_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, title, description, duration_minutes AS "durationMinutes",
                 genre, age_rating AS "ageRating", poster_url AS "posterUrl",
                 trailer_url AS "trailerUrl", status`,
      [
        input.id,
        input.title,
        input.description,
        input.durationMinutes,
        input.genre,
        input.ageRating,
        input.posterUrl,
        input.trailerUrl,
        input.status,
      ],
    );
    return result.rows[0];
  }

  async updateMovie(id: string, input: Record<string, unknown>): Promise<unknown | undefined> {
    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      durationMinutes: 'duration_minutes',
      genre: 'genre',
      ageRating: 'age_rating',
      posterUrl: 'poster_url',
      trailerUrl: 'trailer_url',
      status: 'status',
    };
    const entries = Object.entries(input).filter(([key, value]) => fieldMap[key] && value !== undefined);
    if (entries.length === 0) {
      return this.findMovie(id);
    }
    const values = entries.map(([, value]) => value);
    const assignments = entries.map(([key], index) => `${fieldMap[key]} = $${index + 1}`);
    values.push(id);
    const result = await this.database.query(
      `UPDATE movies SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING id, title, description, duration_minutes AS "durationMinutes",
                 genre, age_rating AS "ageRating", poster_url AS "posterUrl",
                 trailer_url AS "trailerUrl", status`,
      values,
    );
    return result.rows[0];
  }

  async findMovie(id: string): Promise<unknown | undefined> {
    const result = await this.database.query(
      `SELECT id, title, description, duration_minutes AS "durationMinutes",
              genre, age_rating AS "ageRating", poster_url AS "posterUrl",
              trailer_url AS "trailerUrl", status
       FROM movies WHERE id = $1`,
      [id],
    );
    return result.rows[0];
  }

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

  async listScreens(branchId?: string): Promise<unknown[]> {
    const values = branchId ? [branchId] : [];
    const result = await this.database.query(
      `SELECT id, branch_id AS "branchId", name, capacity, layout_version AS "layoutVersion"
       FROM screens ${branchId ? 'WHERE branch_id = $1' : ''} ORDER BY name ASC`,
      values,
    );
    return result.rows;
  }

  async createScreen(id: string, input: { branchId: string; name: string; capacity: number }): Promise<unknown> {
    const result = await this.database.query(
      `INSERT INTO screens (id, branch_id, name, capacity)
       VALUES ($1, $2, $3, $4)
       RETURNING id, branch_id AS "branchId", name, capacity, layout_version AS "layoutVersion"`,
      [id, input.branchId, input.name, input.capacity],
    );
    return result.rows[0];
  }

  async updateLayout(screenId: string, seats: Array<{ label: string; type: SeatType; row: string; number: number }>): Promise<unknown> {
    return this.transactions.run(async (client) => {
      const screen = await client.query<{ capacity: number; layout_version: number }>(
        'SELECT capacity, layout_version FROM screens WHERE id = $1 FOR UPDATE',
        [screenId],
      );
      if (screen.rowCount !== 1) {
        return undefined;
      }
      if (screen.rows[0].capacity !== seats.length) {
        throw new Error('Seat layout count must equal screen capacity');
      }
      await client.query('DELETE FROM screen_seats WHERE screen_id = $1', [screenId]);
      for (const seat of seats) {
        await client.query(
          `INSERT INTO screen_seats
           (id, screen_id, label, seat_type, row_label, seat_number)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
          [screenId, seat.label, seat.type, seat.row, seat.number],
        );
      }
      const result = await client.query(
        `UPDATE screens SET layout_version = layout_version + 1, updated_at = NOW()
         WHERE id = $1
         RETURNING id, branch_id AS "branchId", name, capacity,
                   layout_version AS "layoutVersion"`,
        [screenId],
      );
      return result.rows[0];
    });
  }

  async findScreen(screenId: string): Promise<{ id: string; branch_id: string } | undefined> {
    const result = await this.database.query(
      'SELECT id, branch_id FROM screens WHERE id = $1',
      [screenId],
    );
    return result.rows[0];
  }
}
