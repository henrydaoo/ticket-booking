import { Module } from '@nestjs/common';
import { GATEWAY_CONFIG, loadGatewayConfig } from './config';

@Module({
  providers: [
    {
      provide: GATEWAY_CONFIG,
      useFactory: loadGatewayConfig,
    },
  ],
  exports: [GATEWAY_CONFIG],
})
export class GatewayConfigModule {}
