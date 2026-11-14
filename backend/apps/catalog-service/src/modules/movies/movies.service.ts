import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CatalogPrincipal, requirePlatformAdmin } from '../../common/principal';
import { withCatalogConflictMapping } from '../../common/catalog-conflict';
import { CreateMovieDto, MovieStatus, UpdateMovieDto } from './dto/movie.dto';
import { MoviesRepository } from './movies.repository';

@Injectable()
export class MoviesService {
  constructor(private readonly repository: MoviesRepository) {}

  listMovies(search?: string, status?: MovieStatus): Promise<unknown[]> {
    return this.repository.listMovies(search, status);
  }

  async createMovie(principal: CatalogPrincipal, input: CreateMovieDto): Promise<unknown> {
    requirePlatformAdmin(principal);
    return withCatalogConflictMapping(() =>
      this.repository.createMovie({ id: randomUUID(), ...input }),
    );
  }

  async updateMovie(
    principal: CatalogPrincipal,
    movieId: string,
    input: UpdateMovieDto,
  ): Promise<unknown> {
    requirePlatformAdmin(principal);
    const movie = await this.repository.updateMovie(
      movieId,
      Object.fromEntries(Object.entries(input)),
    );
    if (!movie) {
      throw new NotFoundException('Movie not found');
    }
    return movie;
  }
}
