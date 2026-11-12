import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { GATEWAY_CONFIG, GatewayConfig } from '../config';
import { Inject } from '@nestjs/common';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly attempts = new Map<string, number[]>();

  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = `${request.ip}:${request.method}:${request.path}`;
    const now = Date.now();
    const windowStart = now - this.config.rateLimitWindowSeconds * 1000;
    const recent = (this.attempts.get(key) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );

    if (recent.length >= this.config.rateLimitMaxRequests) {
      throw new HttpException(
        'Authentication rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.attempts.set(key, recent);
    return true;
  }
}
