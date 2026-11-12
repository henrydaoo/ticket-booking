import { readFileSync } from 'node:fs';
import { createPrivateKey, createPublicKey, randomUUID, sign } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { IDENTITY_CONFIG, IdentityConfig } from '../../config/config';

type JwtPayload = {
  sub: string;
  roles: string[];
  branch_ids: string[];
  mfa_completed: boolean;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
};

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

@Injectable()
export class JwtTokenService {
  private readonly privateKey;
  private readonly publicKey;

  constructor(@Inject(IDENTITY_CONFIG) private readonly config: IdentityConfig) {
    this.privateKey = createPrivateKey(readFileSync(config.jwtPrivateKeyPath));
    this.publicKey = createPublicKey(readFileSync(config.jwtPublicKeyPath));
  }

  issueAccessToken(input: {
    userId: string;
    roles: string[];
    branchIds: string[];
    mfaCompleted: boolean;
  }): { token: string; expiresAt: string; payload: JwtPayload } {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      sub: input.userId,
      roles: input.roles,
      branch_ids: input.branchIds,
      mfa_completed: input.mfaCompleted,
      iss: this.config.jwtIssuer,
      aud: this.config.jwtAudience,
      iat: issuedAt,
      exp: issuedAt + this.config.accessTokenTtlSeconds,
      jti: randomUUID(),
    };
    const encodedHeader = base64Url(
      JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: this.config.jwtKeyId }),
    );
    const encodedPayload = base64Url(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = sign('RSA-SHA256', Buffer.from(signingInput), this.privateKey);

    return {
      token: `${signingInput}.${base64Url(signature)}`,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
      payload,
    };
  }

  jwks(): { keys: Array<Record<string, string>> } {
    const jwk = this.publicKey.export({ format: 'jwk' });

    if (typeof jwk !== 'object' || !jwk || !('n' in jwk) || !('e' in jwk)) {
      throw new Error('Configured JWT public key cannot be exported as RSA JWK');
    }

    return {
      keys: [
        {
          kty: 'RSA',
          n: String(jwk.n),
          e: String(jwk.e),
          alg: 'RS256',
          use: 'sig',
          kid: this.config.jwtKeyId,
        },
      ],
    };
  }
}
