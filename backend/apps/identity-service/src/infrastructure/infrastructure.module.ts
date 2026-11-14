import { Module } from '@nestjs/common';
import { Pool } from 'pg';
import { IDENTITY_CONFIG, loadIdentityConfig } from '../config/config';

@Module({
  providers: [
    {
      provide: IDENTITY_CONFIG,
      useFactory: loadIdentityConfig,
    },
    {
      provide: Pool,
      useFactory: (config: ReturnType<typeof loadIdentityConfig>) =>
        new Pool({ connectionString: config.databaseUrl }),
      inject: [IDENTITY_CONFIG],
    },
  ],
  exports: [IDENTITY_CONFIG, Pool],
})
export class InfrastructureModule {}
