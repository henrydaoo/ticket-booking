import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from './infrastructure/database/database.module';
import { CinemasModule } from './modules/cinemas/cinemas.module';
import { MoviesModule } from './modules/movies/movies.module';
import { ScreensModule } from './modules/screens/screens.module';
import { CatalogOutboxModule } from './modules/showtimes/outbox/catalog-outbox.module';
import { ShowtimesModule } from './modules/showtimes/showtimes.module';

@Module({
  imports: [
    DatabaseModule,
    MoviesModule,
    CinemasModule,
    ScreensModule,
    ShowtimesModule,
    CatalogOutboxModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
