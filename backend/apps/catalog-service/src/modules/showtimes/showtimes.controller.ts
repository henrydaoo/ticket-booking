import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { CreateShowtimeDto, PublishShowtimeDto, ShowtimeQueryDto, UpdateDraftShowtimeDto } from './dto/showtime.dto';
import { Request } from 'express';
import { principalFromHeaders } from '../../common/principal';
import { ShowtimesService } from './showtimes.service';

@Controller()
export class ShowtimesController {
  constructor(private readonly catalog: ShowtimesService) {}

  @Get('showtimes')
  showtimes(@Query() filter: ShowtimeQueryDto): Promise<unknown[]> {
    return this.catalog.listShowtimes(filter);
  }

  @Get('showtimes/drafts')
  draftShowtimes(@Req() request: Request): Promise<unknown[]> {
    return this.catalog.listDraftShowtimes(principalFromHeaders(request.headers));
  }

  @Get('showtimes/:showtimeId')
  showtime(@Param('showtimeId') showtimeId: string): Promise<unknown> {
    return this.catalog.getPublishedShowtime(showtimeId);
  }

  @Post('showtimes')
  createShowtime(
    @Req() request: Request,
    @Body() body: CreateShowtimeDto,
  ): Promise<unknown> {
    return this.catalog.createShowtime(principalFromHeaders(request.headers), body);
  }

  @Patch('showtimes/:showtimeId')
  updateDraftShowtime(
    @Req() request: Request,
    @Param('showtimeId') showtimeId: string,
    @Body() body: UpdateDraftShowtimeDto,
  ): Promise<unknown> {
    return this.catalog.updateDraftShowtime(
      principalFromHeaders(request.headers),
      showtimeId,
      body,
    );
  }

  @Post('showtimes/:showtimeId/publish')
  publishShowtime(
    @Req() request: Request,
    @Param('showtimeId') showtimeId: string,
    @Body() body: PublishShowtimeDto,
    @Headers('x-correlation-id') correlationId: string,
  ): Promise<unknown> {
    return this.catalog.publishShowtime(
      principalFromHeaders(request.headers),
      showtimeId,
      body,
      correlationId,
    );
  }
}
