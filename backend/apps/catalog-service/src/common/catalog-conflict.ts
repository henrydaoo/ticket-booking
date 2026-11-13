import { ConflictException, NotFoundException } from '@nestjs/common';
import { CatalogDomainError } from './catalog.errors';

export async function withCatalogConflictMapping<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CatalogDomainError) {
      switch (error.code) {
        case 'NOT_FOUND':
          throw new NotFoundException(error.message);
        case 'SCHEDULE_CONFLICT':
        case 'LAYOUT_PROTECTED':
        case 'INVALID_STATE':
        case 'MISSING_LAYOUT':
        case 'MISSING_PRICE':
          throw new ConflictException(error.message);
      }
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      throw new ConflictException('Catalog resource already exists');
    }
    throw error;
  }
}
