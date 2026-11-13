import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { CreateBranchDto, CreateCinemaDto } from './dto/cinema.dto';
import { Request } from 'express';
import { principalFromHeaders } from '../../common/principal';
import { CinemasService } from './cinemas.service';

@Controller()
export class CinemasController {
  constructor(private readonly catalog: CinemasService) {}

  @Get('cinemas')
  cinemas(): Promise<unknown[]> {
    return this.catalog.listCinemas();
  }

  @Post('cinemas')
  createCinema(@Req() request: Request, @Body() body: CreateCinemaDto): Promise<unknown> {
    return this.catalog.createCinema(principalFromHeaders(request.headers), body);
  }

  @Get('branches')
  branches(): Promise<unknown[]> {
    return this.catalog.listBranches();
  }

  @Post('branches')
  createBranch(@Req() request: Request, @Body() body: CreateBranchDto): Promise<unknown> {
    return this.catalog.createBranch(principalFromHeaders(request.headers), body);
  }
}
