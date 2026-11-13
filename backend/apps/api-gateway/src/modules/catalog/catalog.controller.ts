import { Body, Controller, Get, Headers, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { CORRELATION_ID_HEADER } from '../../correlation-id.middleware';
import { AuthGuard, principalFromRequest } from '../auth/auth.guard';
import { RequirePlatformAdminMfa, RequireRoles } from '../auth/auth.decorators';
import { RolesGuard } from '../auth/roles.guard';
import { CatalogProxy } from './catalog.proxy';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly proxy: CatalogProxy) {}

  @Get('health')
  health(): Promise<unknown> {
    return this.proxy.forward('/health');
  }

  @Get('movies')
  movies(@Headers(CORRELATION_ID_HEADER) correlationId?: string): Promise<unknown> {
    return this.proxy.forward('/movies', correlationId);
  }

  @Get('showtimes')
  showtimes(
    @Req() request: Request,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    const queryIndex = request.originalUrl.indexOf('?');
    const query = queryIndex < 0 ? '' : request.originalUrl.slice(queryIndex);
    return this.proxy.forward(`/showtimes${query}`, correlationId);
  }

  @Get('showtimes/drafts')
  @UseGuards(AuthGuard, RolesGuard)
  @RequireRoles('CINEMA_MANAGER', 'PLATFORM_ADMIN')
  draftShowtimes(
    @Req() request: Request,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.forward(
      '/showtimes/drafts',
      correlationId,
      principalFromRequest(request),
    );
  }

  @Get('showtimes/:showtimeId')
  showtime(
    @Req() request: Request,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    const showtimeId = request.params.showtimeId;
    return this.proxy.forward(`/showtimes/${showtimeId}`, correlationId);
  }

  @Post('movies')
  @UseGuards(AuthGuard, RolesGuard)
  @RequireRoles('PLATFORM_ADMIN')
  @RequirePlatformAdminMfa()
  createMovie(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.forward(
      '/movies',
      correlationId,
      principalFromRequest(request),
      'POST',
      body,
    );
  }

  @Patch('movies/:movieId')
  @UseGuards(AuthGuard, RolesGuard)
  @RequireRoles('PLATFORM_ADMIN')
  @RequirePlatformAdminMfa()
  updateMovie(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    const movieId = request.params.movieId;
    return this.proxy.forward(
      `/movies/${movieId}`,
      correlationId,
      principalFromRequest(request),
      'PATCH',
      body,
    );
  }

  @Post('cinemas')
  @UseGuards(AuthGuard, RolesGuard)
  @RequireRoles('PLATFORM_ADMIN')
  @RequirePlatformAdminMfa()
  createCinema(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.forward(
      '/cinemas',
      correlationId,
      principalFromRequest(request),
      'POST',
      body,
    );
  }

  @Post('branches')
  @UseGuards(AuthGuard, RolesGuard)
  @RequireRoles('PLATFORM_ADMIN')
  @RequirePlatformAdminMfa()
  createBranch(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.forward(
      '/branches',
      correlationId,
      principalFromRequest(request),
      'POST',
      body,
    );
  }

  @Post('screens')
  @UseGuards(AuthGuard, RolesGuard)
  @RequireRoles('CINEMA_MANAGER', 'PLATFORM_ADMIN')
  createScreen(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.forward(
      '/screens',
      correlationId,
      principalFromRequest(request),
      'POST',
      body,
    );
  }

  @Put('screens/:screenId/layout')
  @UseGuards(AuthGuard, RolesGuard)
  @RequireRoles('CINEMA_MANAGER', 'PLATFORM_ADMIN')
  updateLayout(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    const screenId = request.params.screenId;
    return this.proxy.forward(
      `/screens/${screenId}/layout`,
      correlationId,
      principalFromRequest(request),
      'PUT',
      body,
    );
  }

  @Put('screens/:screenId/prices')
  @UseGuards(AuthGuard, RolesGuard)
  @RequireRoles('CINEMA_MANAGER', 'PLATFORM_ADMIN')
  updateScreenPrices(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    const screenId = request.params.screenId;
    return this.proxy.forward(
      `/screens/${screenId}/prices`,
      correlationId,
      principalFromRequest(request),
      'PUT',
      body,
    );
  }

  @Post('showtimes')
  @UseGuards(AuthGuard, RolesGuard)
  @RequireRoles('CINEMA_MANAGER', 'PLATFORM_ADMIN')
  createShowtime(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    return this.proxy.forward(
      '/showtimes',
      correlationId,
      principalFromRequest(request),
      'POST',
      body,
    );
  }

  @Patch('showtimes/:showtimeId')
  @UseGuards(AuthGuard, RolesGuard)
  @RequireRoles('CINEMA_MANAGER', 'PLATFORM_ADMIN')
  updateDraftShowtime(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    const showtimeId = request.params.showtimeId;
    return this.proxy.forward(
      `/showtimes/${showtimeId}`,
      correlationId,
      principalFromRequest(request),
      'PATCH',
      body,
    );
  }

  @Post('showtimes/:showtimeId/publish')
  @UseGuards(AuthGuard, RolesGuard)
  @RequireRoles('CINEMA_MANAGER', 'PLATFORM_ADMIN')
  publishShowtime(
    @Req() request: Request,
    @Body() body: unknown,
    @Headers(CORRELATION_ID_HEADER) correlationId?: string,
  ): Promise<unknown> {
    const showtimeId = request.params.showtimeId;
    return this.proxy.forward(
      `/showtimes/${showtimeId}/publish`,
      correlationId,
      principalFromRequest(request),
      'POST',
      body,
    );
  }
}
