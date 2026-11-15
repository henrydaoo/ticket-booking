import { UnauthorizedException } from '@nestjs/common';
import { IncomingHttpHeaders } from 'node:http';

export type PaymentPrincipal = {
  userId: string;
};

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function principalFromHeaders(headers: IncomingHttpHeaders): PaymentPrincipal {
  const userId = headerValue(headers['x-authenticated-user-id']);
  if (!userId) throw new UnauthorizedException('Authenticated principal is missing');
  return { userId };
}
