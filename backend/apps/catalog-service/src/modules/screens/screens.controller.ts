import { Body, Controller, Get, Headers, Param, Post, Put, Query, Req } from '@nestjs/common';
import { CreateScreenDto, UpdateLayoutDto, UpdateScreenPricesDto } from './dto/screen.dto';
import { Request } from 'express';
import { principalFromHeaders } from '../../common/principal';
import { ScreensService } from './screens.service';

@Controller()
export class ScreensController {
  constructor(private readonly catalog: ScreensService) {}

  @Get('screens')
  screens(
    @Req() request: Request,
    @Query('branchId') branchId?: string,
    @Headers('x-authenticated-user-id') userId?: string,
  ): Promise<unknown[]> {
    return this.catalog.listScreens(
      userId ? principalFromHeaders(request.headers) : undefined,
      branchId,
    );
  }

  @Post('screens')
  createScreen(@Req() request: Request, @Body() body: CreateScreenDto): Promise<unknown> {
    return this.catalog.createScreen(principalFromHeaders(request.headers), body);
  }

  @Put('screens/:screenId/layout')
  updateLayout(
    @Req() request: Request,
    @Param('screenId') screenId: string,
    @Body() body: UpdateLayoutDto,
  ): Promise<unknown> {
    return this.catalog.updateLayout(principalFromHeaders(request.headers), screenId, body);
  }

  @Put('screens/:screenId/prices')
  updateScreenPrices(
    @Req() request: Request,
    @Param('screenId') screenId: string,
    @Body() body: UpdateScreenPricesDto,
  ): Promise<unknown> {
    return this.catalog.updateScreenPrices(principalFromHeaders(request.headers), screenId, body);
  }
}
