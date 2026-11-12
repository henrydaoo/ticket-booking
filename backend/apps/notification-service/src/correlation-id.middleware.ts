import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

export function correlationIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const correlationId = request.header(CORRELATION_ID_HEADER)?.trim() || randomUUID();
  request.headers[CORRELATION_ID_HEADER] = correlationId;
  response.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
}

