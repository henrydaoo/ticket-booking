import {
  createPublicKey,
  createVerify,
} from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { GATEWAY_CONFIG, GatewayConfig } from '../../config';
import { JwksClientService } from './jwks-client.service';
import { JwtVerificationResult } from './auth.types';

function decodeJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    throw new UnauthorizedException('Malformed access token');
  }
}

function claimString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new UnauthorizedException(`Access token claim ${name} is invalid`);
  }
  return value;
}

function claimNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new UnauthorizedException(`Access token claim ${name} is invalid`);
  }
  return value;
}

function claimStringArray(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new UnauthorizedException(`Access token claim ${name} is invalid`);
  }
  return value;
}

@Injectable()
export class JwtVerifierService {
  constructor(
    private readonly jwks: JwksClientService,
    @Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig,
  ) {}

  async verify(authorization: string | undefined): Promise<JwtVerificationResult> {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Bearer access token is required');
    }

    const token = authorization.slice('Bearer '.length).trim();
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Malformed access token');
    }

    const header = decodeJson(parts[0]);
    const payload = decodeJson(parts[1]);
    if (header.alg !== 'RS256') {
      throw new UnauthorizedException('Unsupported access token algorithm');
    }

    const kid = claimString(header.kid, 'kid');
    const key = await this.jwks.getKey(kid);
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);
    verifier.end();

    const publicKey = createPublicKey({ key, format: 'jwk' });
    const signature = Buffer.from(parts[2], 'base64url');
    if (!verifier.verify(publicKey, signature)) {
      throw new UnauthorizedException('Invalid access token signature');
    }

    const issuer = claimString(payload.iss, 'iss');
    const audience = payload.aud;
    const validAudience =
      typeof audience === 'string'
        ? audience === this.config.jwtAudience
        : Array.isArray(audience) && audience.includes(this.config.jwtAudience);
    if (issuer !== this.config.jwtIssuer || !validAudience) {
      throw new UnauthorizedException('Access token issuer or audience is invalid');
    }

    const issuedAt = claimNumber(payload.iat, 'iat');
    const expiresAt = claimNumber(payload.exp, 'exp');
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt <= now || issuedAt > now + 60) {
      throw new UnauthorizedException('Access token is expired or not yet valid');
    }

    const mfaCompleted = payload.mfa_completed;
    if (typeof mfaCompleted !== 'boolean') {
      throw new UnauthorizedException('Access token claim mfa_completed is invalid');
    }

    return {
      token,
      principal: {
        sub: claimString(payload.sub, 'sub'),
        roles: claimStringArray(payload.roles, 'roles'),
        branchIds: claimStringArray(payload.branch_ids, 'branch_ids'),
        mfaCompleted,
        issuer,
        audience: audience as string | string[],
        issuedAt,
        expiresAt,
        tokenId: claimString(payload.jti, 'jti'),
      },
    };
  }
}
