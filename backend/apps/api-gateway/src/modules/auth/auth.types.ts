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

export function principalHeaders(principal: AuthenticatedPrincipal): Record<string, string> {
  return {
    'x-authenticated-user-id': principal.sub,
    'x-authenticated-roles': JSON.stringify(principal.roles),
    'x-authenticated-branch-ids': JSON.stringify(principal.branchIds),
    'x-authenticated-mfa-completed': String(principal.mfaCompleted),
  };
}
