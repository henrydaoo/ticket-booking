import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GATEWAY_CONFIG, GatewayConfig } from '../../config';

type JsonWebKey = {
  kid?: string;
  kty: string;
  n?: string;
  e?: string;
  alg?: string;
  use?: string;
};

type JwksResponse = {
  keys: JsonWebKey[];
};

@Injectable()
export class JwksClientService {
  private cachedKeys = new Map<string, JsonWebKey>();
  private expiresAt = 0;
  private refreshPromise?: Promise<void>;

  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  async getKey(kid: string): Promise<JsonWebKey> {
    await this.ensureFresh();
    const cached = this.cachedKeys.get(kid);
    if (cached) {
      return cached;
    }

    await this.refresh();
    const refreshed = this.cachedKeys.get(kid);
    if (!refreshed) {
      throw new ServiceUnavailableException('JWT signing key is not available');
    }
    return refreshed;
  }

  private async ensureFresh(): Promise<void> {
    if (this.cachedKeys.size > 0 && Date.now() < this.expiresAt) {
      return;
    }
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.fetchKeys().finally(() => {
        this.refreshPromise = undefined;
      });
    }
    await this.refreshPromise;
  }

  private async fetchKeys(): Promise<void> {
    try {
      const response = await fetch(this.config.identityJwksUrl);
      if (!response.ok) {
        throw new Error(`Identity JWKS returned HTTP ${response.status}`);
      }

      const body = (await response.json()) as JwksResponse;
      const keys = body.keys.filter(
        (key) => key.kty === 'RSA' && key.n && key.e && key.kid,
      );
      if (keys.length === 0) {
        throw new Error('Identity JWKS did not contain usable RSA keys');
      }

      this.cachedKeys = new Map(keys.map((key) => [key.kid as string, key]));
      this.expiresAt = Date.now() + this.config.jwksCacheTtlSeconds * 1000;
    } catch (error) {
      throw new ServiceUnavailableException('Identity JWKS is unavailable', {
        cause: error,
      });
    }
  }
}
