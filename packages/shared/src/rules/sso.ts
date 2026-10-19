/**
 * Entra ID SSO mapping (plan section 5): the `email` claim of the id_token, falling back to
 * `preferred_username`, is matched case-insensitively against the employee email from DMP.
 */
export interface EntraClaims {
  email?: unknown;
  preferred_username?: unknown;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function asEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeEmail(value);
  return normalized.includes('@') ? normalized : null;
}

/** Normalized email taken from the claims, or null when neither claim holds an email. */
export function extractEntraEmail(claims: EntraClaims): string | null {
  return asEmail(claims.email) ?? asEmail(claims.preferred_username);
}
