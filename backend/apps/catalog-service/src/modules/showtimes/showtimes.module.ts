import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ScreensModule } from '../screens/screens.module';
import { ShowtimesController } from './showtimes.controller';
import { ShowtimesRepository } from './showtimes.repository';
import { ShowtimesService } from './showtimes.service';

@Module({
  imports: [DatabaseModule, ScreensModule],
  controllers: [ShowtimesController],
  providers: [ShowtimesService, ShowtimesRepository],
})
export class ShowtimesModule {}
