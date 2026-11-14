import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { MovieStatus } from './dto/movie.dto';

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
export class MoviesRepository {
  constructor(@Inject(Pool) private readonly database: Pool) {}

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
}
