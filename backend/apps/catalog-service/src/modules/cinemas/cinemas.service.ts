import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CatalogPrincipal, requirePlatformAdmin } from '../../common/principal';
import { withCatalogConflictMapping } from '../../common/catalog-conflict';
import { CreateBranchDto, CreateCinemaDto } from './dto/cinema.dto';
import { CinemasRepository } from './cinemas.repository';

@Injectable()
export class CinemasService {
  constructor(private readonly repository: CinemasRepository) {}

  listCinemas(): Promise<unknown[]> {
    return this.repository.listCinemas();
  }

  async getCinema(cinemaId: string): Promise<unknown> {
    const cinema = await this.repository.getCinema(cinemaId);
    if (!cinema) {
      throw new NotFoundException('Cinema not found');
    }
    return cinema;
  }

  async createCinema(principal: CatalogPrincipal, input: CreateCinemaDto): Promise<unknown> {
    requirePlatformAdmin(principal);
    return withCatalogConflictMapping(() =>
      this.repository.createCinema(randomUUID(), input.name),
    );
  }

  listBranches(): Promise<unknown[]> {
    return this.repository.listBranches();
  }

  async createBranch(principal: CatalogPrincipal, input: CreateBranchDto): Promise<unknown> {
    requirePlatformAdmin(principal);
    return withCatalogConflictMapping(() =>
      this.repository.createBranch(randomUUID(), input),
    );
  }
}
