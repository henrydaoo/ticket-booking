import { Module } from '@nestjs/common';
import { GatewayConfigModule } from '../../config.module';
import { AuthModule } from '../auth/auth.module';
import { CatalogController } from './catalog.controller';
import { CatalogProxy } from './catalog.proxy';

@Module({
  imports: [GatewayConfigModule, AuthModule],
  controllers: [CatalogController],
  providers: [CatalogProxy],
})
export class CatalogModule {}
