import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { CATALOG_CONFIG, loadCatalogConfig } from '../../config';
import { TransactionRunner } from '../../infrastructure/database/transaction.runner';
import { CatalogController } from './catalog.controller';
import { CatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController],
  providers: [
    CatalogService,
    CatalogRepository,
    TransactionRunner,
    {
      provide: CATALOG_CONFIG,
      useFactory: loadCatalogConfig,
    },
    {
      provide: Pool,
      useFactory: (config: ReturnType<typeof loadCatalogConfig>) =>
        new Pool({ connectionString: config.databaseUrl }),
      inject: [CATALOG_CONFIG],
    },
  ],
  exports: [CATALOG_CONFIG, Pool],
})
export class CatalogModule {}
