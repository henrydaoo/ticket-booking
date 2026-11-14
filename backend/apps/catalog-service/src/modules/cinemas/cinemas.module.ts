import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { CinemasController } from './cinemas.controller';
import { CinemasRepository } from './cinemas.repository';
import { CinemasService } from './cinemas.service';

@Module({
  imports: [DatabaseModule],
  controllers: [CinemasController],
  providers: [CinemasService, CinemasRepository],
})
export class CinemasModule {}
