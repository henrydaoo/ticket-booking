import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CatalogPrincipal, requireCatalogManager } from '../../common/principal';
import { withCatalogConflictMapping } from '../../common/catalog-conflict';
import { CreateScreenDto, UpdateLayoutDto, UpdateScreenPricesDto } from './dto/screen.dto';
import { ScreensRepository } from './screens.repository';

@Injectable()
export class ScreensService {
  constructor(private readonly repository: ScreensRepository) {}

  async requireScreenManager(principal: CatalogPrincipal, screenId: string): Promise<void> {
    const screen = await this.repository.findScreen(screenId);
    if (!screen) {
      throw new NotFoundException('Screen not found');
    }
    requireCatalogManager(principal, screen.branch_id);
  }

  listScreens(principal: CatalogPrincipal | undefined, branchId?: string): Promise<unknown[]> {
    if (principal && branchId) {
      requireCatalogManager(principal, branchId);
    }
    return this.repository.listScreens(branchId);
  }

  async createScreen(principal: CatalogPrincipal, input: CreateScreenDto): Promise<unknown> {
    requireCatalogManager(principal, input.branchId);
    return withCatalogConflictMapping(() =>
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
    return withCatalogConflictMapping(async () => {
      const updated = await this.repository.updateLayout(screenId, input.seats);
      if (!updated) {
        throw new NotFoundException('Screen not found');
      }
      return updated;
    });
  }

  async updateScreenPrices(
    principal: CatalogPrincipal,
    screenId: string,
    input: UpdateScreenPricesDto,
  ): Promise<{ screenId: string; pricingVersion: number; prices: Record<string, number> }> {
    const screen = await this.repository.findScreen(screenId);
    if (!screen) {
      throw new NotFoundException('Screen not found');
    }
    requireCatalogManager(principal, screen.branch_id);
    const seatTypes = input.prices.map((price) => price.seatType);
    if (new Set(seatTypes).size !== seatTypes.length) {
      throw new BadRequestException('Seat type prices must not contain duplicates');
    }
    const updated = await this.repository.updateScreenPrices(screenId, input.prices);
    if (!updated) {
      throw new NotFoundException('Screen not found');
    }
    return updated;
  }
}
