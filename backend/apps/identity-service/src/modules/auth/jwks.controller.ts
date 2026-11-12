import { Controller, Get, HttpCode } from '@nestjs/common';
import { JwtTokenService } from './jwt-token.service';

@Controller('.well-known')
export class JwksController {
  constructor(private readonly jwtTokens: JwtTokenService) {}

  @Get('jwks.json')
  @HttpCode(200)
  jwks(): { keys: Array<Record<string, string>> } {
    return this.jwtTokens.jwks();
  }
}

