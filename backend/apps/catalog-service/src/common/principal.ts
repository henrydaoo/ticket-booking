import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';

export type CatalogPrincipal = {
  userId: string;
  roles: string[];
  branchIds: string[];
  mfaCompleted: boolean;
};

export function principalFromHeaders(headers: Record<string, string | string[] | undefined>): CatalogPrincipal {
  const userId = typeof headers['x-authenticated-user-id'] === 'string'
    ? headers['x-authenticated-user-id']
    : undefined;
  const rolesHeader = typeof headers['x-authenticated-roles'] === 'string'
    ? headers['x-authenticated-roles']
    : undefined;
  const branchIdsHeader = typeof headers['x-authenticated-branch-ids'] === 'string'
    ? headers['x-authenticated-branch-ids']
    : undefined;
  const mfaHeader = typeof headers['x-authenticated-mfa-completed'] === 'string'
    ? headers['x-authenticated-mfa-completed']
    : undefined;

  if (!userId || !rolesHeader || !branchIdsHeader || !mfaHeader) {
    throw new UnauthorizedException('Authenticated principal is required');
  }

  let roles: string[];
  let branchIds: string[];
  try {
    roles = JSON.parse(rolesHeader) as string[];
    branchIds = JSON.parse(branchIdsHeader) as string[];
  } catch {
    throw new BadRequestException('Authenticated principal context is invalid');
  }

  if (
    !Array.isArray(roles) ||
    roles.some((role) => typeof role !== 'string') ||
    !Array.isArray(branchIds) ||
    branchIds.some((branchId) => typeof branchId !== 'string') ||
    !['true', 'false'].includes(mfaHeader)
  ) {
    throw new BadRequestException('Authenticated principal context is invalid');
  }

  return {
    userId,
    roles,
    branchIds,
    mfaCompleted: mfaHeader === 'true',
  };
}

export function requirePlatformAdmin(principal: CatalogPrincipal): void {
  if (!principal.roles.includes('PLATFORM_ADMIN') || !principal.mfaCompleted) {
    throw new ForbiddenException('Completed Platform Admin MFA is required');
  }
}

export function requireCatalogManager(principal: CatalogPrincipal, branchId?: string): void {
  if (principal.roles.includes('PLATFORM_ADMIN')) {
    if (!principal.mfaCompleted) {
      throw new ForbiddenException('Completed Platform Admin MFA is required');
    }
    return;
  }
  if (!principal.roles.includes('CINEMA_MANAGER')) {
    throw new ForbiddenException('Cinema Manager role is required');
  }
  if (branchId && !principal.branchIds.includes(branchId)) {
    throw new ForbiddenException('Branch access is not allowed');
  }
}
