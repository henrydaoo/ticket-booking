import { Module } from '@nestjs/common';
import { GatewayConfigModule } from '../../config.module';
import { CatalogController } from './catalog.controller';
import { CatalogProxy } from './catalog.proxy';

@Module({
  imports: [GatewayConfigModule],
  controllers: [CatalogController],
  providers: [CatalogProxy],
})
export class CatalogModule {}
