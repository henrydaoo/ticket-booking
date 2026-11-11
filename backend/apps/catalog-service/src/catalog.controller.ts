import { Controller, Get, HttpCode } from '@nestjs/common';

@Controller()
export class CatalogController {
  @Get('movies')
  @HttpCode(501)
  moviesBoundary(): {
    statusCode: 501;
    message: string;
  } {
    return {
      statusCode: 501,
      message: 'Catalog business capabilities are deferred to a later step',
    };
  }
}

