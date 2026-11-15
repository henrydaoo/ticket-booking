import { UnauthorizedException } from '@nestjs/common';
import { IncomingHttpHeaders } from 'node:http';

export type BookingPrincipal = {
  userId: string;
  roles: string[];
  branchIds: string[];
};

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function jsonArray(value: string | undefined, field: string): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
      throw new Error(`${field} must be a string array`);
    }
    return parsed;
  } catch {
    throw new UnauthorizedException('Authenticated principal is invalid');
  }
}

export function principalFromHeaders(headers: IncomingHttpHeaders): BookingPrincipal {
  const userId = headerValue(headers['x-authenticated-user-id']);
  if (!userId) {
    throw new UnauthorizedException('Authenticated principal is missing');
  }
  return {
    userId,
    roles: jsonArray(headerValue(headers['x-authenticated-roles']), 'roles'),
    branchIds: jsonArray(headerValue(headers['x-authenticated-branch-ids']), 'branchIds'),
  };
}
