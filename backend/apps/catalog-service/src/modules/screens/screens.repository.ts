import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { TransactionRunner } from '../../infrastructure/database/transaction.runner';
import { CatalogDomainError } from '../../common/catalog.errors';
import { ScreenSeatPriceDto, SeatType } from './dto/screen.dto';

@Injectable()
export class ScreensRepository {
  constructor(@Inject(Pool) private readonly database: Pool, private readonly transactions: TransactionRunner) {}

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
      const protectedShowtime = await client.query(
        `SELECT 1 FROM showtimes
         WHERE screen_id = $1 AND status = 'PUBLISHED'
         LIMIT 1`,
        [screenId],
      );
      if (protectedShowtime.rowCount) {
        throw new CatalogDomainError(
          'LAYOUT_PROTECTED',
          'A published showtime protects this screen layout',
        );
      }
      if (screen.rows[0].capacity !== seats.length) {
        throw new CatalogDomainError(
          'INVALID_STATE',
          'Seat layout count must equal screen capacity',
        );
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

  async updateScreenPrices(
    screenId: string,
    prices: ScreenSeatPriceDto[],
  ): Promise<{ screenId: string; pricingVersion: number; prices: Record<string, number> } | undefined> {
    return this.transactions.run(async (client) => {
      const screen = await client.query<{ pricing_version: number }>(
        'SELECT pricing_version FROM screens WHERE id = $1 FOR UPDATE',
        [screenId],
      );
      if (screen.rowCount !== 1) {
        return undefined;
      }

      await client.query(
        'DELETE FROM screen_seat_type_prices WHERE screen_id = $1',
        [screenId],
      );
      for (const price of prices) {
        await client.query(
          `INSERT INTO screen_seat_type_prices (screen_id, seat_type, price_vnd)
           VALUES ($1, $2, $3)`,
          [screenId, price.seatType, price.priceVnd],
        );
      }

      const updated = await client.query<{ pricing_version: number }>(
        `UPDATE screens
         SET pricing_version = pricing_version + 1, updated_at = NOW()
         WHERE id = $1
         RETURNING pricing_version`,
        [screenId],
      );
      return {
        screenId,
        pricingVersion: updated.rows[0].pricing_version,
        prices: Object.fromEntries(prices.map((price) => [price.seatType, price.priceVnd])),
      };
    });
  }
}
