import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtVerifierService } from './jwt-verifier.service';
import { AuthenticatedPrincipal } from './auth.types';

const principals = new WeakMap<Request, AuthenticatedPrincipal>();

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly verifier: JwtVerifierService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const result = await this.verifier.verify(request.header('authorization'));
    principals.set(request, result.principal);
    return true;
  }
}

export function principalFromRequest(request: Request): AuthenticatedPrincipal {
  const principal = principals.get(request);
  if (!principal) {
    throw new UnauthorizedException('Authenticated principal is missing');
  }
  return principal;
}
