import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { REQUIRE_MFA, REQUIRED_ROLES } from './auth.decorators';
import { principalFromRequest } from './auth.guard';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const principal = principalFromRequest(request);
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_ROLES, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    const requiresMfa =
      this.reflector.getAllAndOverride<boolean>(REQUIRE_MFA, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    if (requiredRoles.length > 0 && !requiredRoles.some((role) => principal.roles.includes(role))) {
      throw new ForbiddenException('Insufficient role');
    }
    if (requiresMfa && (!principal.roles.includes('PLATFORM_ADMIN') || !principal.mfaCompleted)) {
      throw new ForbiddenException('Completed Platform Admin MFA is required');
    }
    return true;
  }
}
