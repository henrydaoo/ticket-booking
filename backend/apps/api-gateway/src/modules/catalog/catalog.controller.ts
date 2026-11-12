import { Controller, Get, Headers } from '@nestjs/common';
import { CORRELATION_ID_HEADER } from '../../correlation-id.middleware';
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
}
