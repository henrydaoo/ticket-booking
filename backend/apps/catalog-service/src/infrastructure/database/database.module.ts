import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { CATALOG_CONFIG, loadCatalogConfig } from '../../config';
import { TransactionRunner } from './transaction.runner';

@Module({
  providers: [
    TransactionRunner,
    { provide: CATALOG_CONFIG, useFactory: loadCatalogConfig },
    {
      provide: Pool,
      useFactory: (config: ReturnType<typeof loadCatalogConfig>) =>
        new Pool({ connectionString: config.databaseUrl }),
      inject: [CATALOG_CONFIG],
    },
  ],
  exports: [CATALOG_CONFIG, Pool, TransactionRunner],
})
export class DatabaseModule {}
