export type AuthenticatedPrincipal = {
  sub: string;
  roles: string[];
  branchIds: string[];
  mfaCompleted: boolean;
  issuer: string;
  audience: string | string[];
  issuedAt: number;
  expiresAt: number;
  tokenId: string;
};

export type JwtVerificationResult = {
  principal: AuthenticatedPrincipal;
  token: string;
};
