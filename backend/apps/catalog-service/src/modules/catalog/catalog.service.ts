import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CatalogPrincipal, requireCatalogManager, requirePlatformAdmin } from '../../common/principal';
import {
  CreateBranchDto,
  CreateCinemaDto,
  CreateMovieDto,
  CreateScreenDto,
  MovieStatus,
  UpdateLayoutDto,
  UpdateMovieDto,
} from './dto/catalog.dto';
import { CatalogRepository } from './catalog.repository';

@Injectable()
export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  listMovies(search?: string, status?: MovieStatus): Promise<unknown[]> {
    return this.repository.listMovies(search, status);
  }

  async createMovie(principal: CatalogPrincipal, input: CreateMovieDto): Promise<unknown> {
    requirePlatformAdmin(principal);
    return this.withConflictMapping(() =>
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

  listCinemas(): Promise<unknown[]> {
    return this.repository.listCinemas();
  }

  async createCinema(principal: CatalogPrincipal, input: CreateCinemaDto): Promise<unknown> {
    requirePlatformAdmin(principal);
    return this.withConflictMapping(() =>
      this.repository.createCinema(randomUUID(), input.name),
    );
  }

  listBranches(): Promise<unknown[]> {
    return this.repository.listBranches();
  }

  async createBranch(principal: CatalogPrincipal, input: CreateBranchDto): Promise<unknown> {
    requirePlatformAdmin(principal);
    return this.withConflictMapping(() =>
      this.repository.createBranch(randomUUID(), input),
    );
  }

  listScreens(principal: CatalogPrincipal | undefined, branchId?: string): Promise<unknown[]> {
    if (principal && branchId) {
      requireCatalogManager(principal, branchId);
    }
    return this.repository.listScreens(branchId);
  }

  async createScreen(principal: CatalogPrincipal, input: CreateScreenDto): Promise<unknown> {
    requireCatalogManager(principal, input.branchId);
    return this.withConflictMapping(() =>
      this.repository.createScreen(randomUUID(), input),
    );
  }

  async updateLayout(
    principal: CatalogPrincipal,
    screenId: string,
    input: UpdateLayoutDto,
  ): Promise<unknown> {
    const screen = await this.repository.findScreen(screenId);
    if (!screen) {
      throw new NotFoundException('Screen not found');
    }
    requireCatalogManager(principal, screen.branch_id);
    try {
      const updated = await this.repository.updateLayout(screenId, input.seats);
      if (!updated) {
        throw new NotFoundException('Screen not found');
      }
      return updated;
    } catch (error) {
      if (error instanceof Error && error.message === 'Seat layout count must equal screen capacity') {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  private async withConflictMapping<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('Catalog resource already exists');
      }
      throw error;
    }
  }
}
