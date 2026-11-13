import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { principalFromHeaders, CatalogPrincipal } from '../../common/principal';
import {
  CreateBranchDto,
  CreateCinemaDto,
  CreateMovieDto,
  CreateScreenDto,
  MovieStatus,
  UpdateLayoutDto,
  UpdateMovieDto,
} from './dto/catalog.dto';
import { CatalogService } from './catalog.service';

function principal(request: Request): CatalogPrincipal {
  return principalFromHeaders(request.headers);
}

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('movies')
  movies(
    @Query('search') search?: string,
    @Query('status') status?: MovieStatus,
  ): Promise<unknown[]> {
    return this.catalog.listMovies(search, status);
  }

  @Post('movies')
  createMovie(@Req() request: Request, @Body() body: CreateMovieDto): Promise<unknown> {
    return this.catalog.createMovie(principal(request), body);
  }

  @Patch('movies/:movieId')
  updateMovie(
    @Req() request: Request,
    @Param('movieId') movieId: string,
    @Body() body: UpdateMovieDto,
  ): Promise<unknown> {
    return this.catalog.updateMovie(principal(request), movieId, body);
  }

  @Get('cinemas')
  cinemas(): Promise<unknown[]> {
    return this.catalog.listCinemas();
  }

  @Post('cinemas')
  createCinema(@Req() request: Request, @Body() body: CreateCinemaDto): Promise<unknown> {
    return this.catalog.createCinema(principal(request), body);
  }

  @Get('branches')
  branches(): Promise<unknown[]> {
    return this.catalog.listBranches();
  }

  @Post('branches')
  createBranch(@Req() request: Request, @Body() body: CreateBranchDto): Promise<unknown> {
    return this.catalog.createBranch(principal(request), body);
  }

  @Get('screens')
  screens(
    @Req() request: Request,
    @Query('branchId') branchId?: string,
    @Headers('x-authenticated-user-id') userId?: string,
  ): Promise<unknown[]> {
    return this.catalog.listScreens(
      userId ? principal(request) : undefined,
      branchId,
    );
  }

  @Post('screens')
  createScreen(@Req() request: Request, @Body() body: CreateScreenDto): Promise<unknown> {
    return this.catalog.createScreen(principal(request), body);
  }

  @Put('screens/:screenId/layout')
  updateLayout(
    @Req() request: Request,
    @Param('screenId') screenId: string,
    @Body() body: UpdateLayoutDto,
  ): Promise<unknown> {
    return this.catalog.updateLayout(principal(request), screenId, body);
  }
}
