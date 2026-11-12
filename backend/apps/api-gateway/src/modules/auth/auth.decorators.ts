import { SetMetadata } from '@nestjs/common';

export const REQUIRED_ROLES = 'required_roles';
export const REQUIRE_MFA = 'require_mfa';

export const RequireRoles = (...roles: string[]) =>
  SetMetadata(REQUIRED_ROLES, roles);

export const RequirePlatformAdminMfa = () => SetMetadata(REQUIRE_MFA, true);
