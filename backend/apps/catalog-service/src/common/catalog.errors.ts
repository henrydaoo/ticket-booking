export type CatalogErrorCode =
  | 'NOT_FOUND'
  | 'SCHEDULE_CONFLICT'
  | 'LAYOUT_PROTECTED'
  | 'INVALID_STATE'
  | 'MISSING_LAYOUT'
  | 'MISSING_PRICE';

export class CatalogDomainError extends Error {
  constructor(
    readonly code: CatalogErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CatalogDomainError';
  }
}
