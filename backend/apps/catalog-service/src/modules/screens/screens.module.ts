import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ScreensController } from './screens.controller';
import { ScreensRepository } from './screens.repository';
import { ScreensService } from './screens.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ScreensController],
  providers: [ScreensService, ScreensRepository],
  exports: [ScreensService],
})
export class ScreensModule {}
