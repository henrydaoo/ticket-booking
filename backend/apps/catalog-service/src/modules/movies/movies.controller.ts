import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { CreateMovieDto, MovieStatus, UpdateMovieDto } from './dto/movie.dto';
import { Request } from 'express';
import { principalFromHeaders } from '../../common/principal';
import { MoviesService } from './movies.service';

@Controller()
export class MoviesController {
  constructor(private readonly catalog: MoviesService) {}

  @Get('movies')
  movies(
    @Query('search') search?: string,
    @Query('status') status?: MovieStatus,
  ): Promise<unknown[]> {
    return this.catalog.listMovies(search, status);
  }

  @Post('movies')
  createMovie(@Req() request: Request, @Body() body: CreateMovieDto): Promise<unknown> {
    return this.catalog.createMovie(principalFromHeaders(request.headers), body);
  }

  @Patch('movies/:movieId')
  updateMovie(
    @Req() request: Request,
    @Param('movieId') movieId: string,
    @Body() body: UpdateMovieDto,
  ): Promise<unknown> {
    return this.catalog.updateMovie(principalFromHeaders(request.headers), movieId, body);
  }
}
