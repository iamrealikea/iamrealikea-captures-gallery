/**
 * worker/auth.ts
 *
 * Cloudflare Access (Zero Trust) RS256 JWT verification middleware
 * with automatic local development bypass.
 */

import type { AuthSession } from '../src/types/gallery';

export interface AuthEnv {
  ENVIRONMENT?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
}

export interface JwtHeader {
  alg: string;
  kid?: string;
  typ?: string;
}

export interface JwtPayload {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  iss?: string;
  sub?: string;
}

export interface CloudflareCertsResponse {
  keys: Array<JsonWebKey & { kid?: string }>;
}

export interface VerifyAuthResult extends AuthSession {
  error?: string;
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const bytes = base64UrlToUint8Array(segment);
  const jsonText = new TextDecoder().decode(bytes);
  return JSON.parse(jsonText) as T;
}

function extractJwtFromRequest(request: Request): string | null {
  const headerToken = request.headers.get('Cf-Access-Jwt-Assertion');
  if (headerToken && headerToken.trim()) {
    return headerToken.trim();
  }

  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const match = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookieHeader);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

interface CachedJwks {
  data: CloudflareCertsResponse;
  cachedAt: number;
}

const CERTS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL
const jwksCache = new Map<string, CachedJwks>();

/**
 * Clears the JWKS certificate cache (useful for testing and key rotation).
 */
export function clearCertsCache(): void {
  jwksCache.clear();
}

async function getCloudflareCerts(
  certsUrl: string,
  customFetch: typeof fetch,
  requiredKid?: string
): Promise<{ data: CloudflareCertsResponse | null; error?: string }> {
  const cached = jwksCache.get(certsUrl);
  const now = Date.now();

  // If cached and not expired, and contains the required kid (or no kid required)
  if (cached && now - cached.cachedAt < CERTS_CACHE_TTL_MS) {
    if (
      !requiredKid ||
      (Array.isArray(cached.data?.keys) &&
        cached.data.keys.some((k) => k.kid === requiredKid))
    ) {
      return { data: cached.data };
    }
  }

  // Fetch fresh JWKS
  try {
    const certsRes = await customFetch(certsUrl);
    if (!certsRes.ok) {
      return {
        data: null,
        error: `Failed to fetch Cloudflare Access certs: HTTP ${certsRes.status}`,
      };
    }
    const certsData = (await certsRes.json()) as CloudflareCertsResponse;
    jwksCache.set(certsUrl, { data: certsData, cachedAt: now });
    return { data: certsData };
  } catch (err) {
    return {
      data: null,
      error: `Error fetching Cloudflare Access certs: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

/**
 * Verifies Cloudflare Access Zero Trust authentication for incoming requests.
 *
 * - In local development (`env.ENVIRONMENT === 'development'` or localhost without explicit production mode),
 *   automatically bypasses JWT verification with `{ authenticated: true, email: 'dev@localhost', mode: 'development-bypass' }`.
 * - In production (`env.ENVIRONMENT === 'production'`), validates the RS256 signature, audience,
 *   and expiration of `Cf-Access-Jwt-Assertion` against `https://<CF_ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs`.
 */
export async function verifyCloudflareAccess(
  request: Request,
  env: AuthEnv,
  customFetch: typeof fetch = fetch
): Promise<VerifyAuthResult> {
  const isExplicitProduction = env.ENVIRONMENT === 'production';

  // Local development automatic bypass
  if (!isExplicitProduction) {
    return {
      authenticated: true,
      email: 'dev@localhost',
      mode: 'development-bypass',
    };
  }

  const token = extractJwtFromRequest(request);
  if (!token) {
    return {
      authenticated: false,
      email: null,
      mode: 'unauthenticated',
      error: 'Missing Cf-Access-Jwt-Assertion header',
    };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return {
      authenticated: false,
      email: null,
      mode: 'unauthenticated',
      error: 'Malformed JWT structure',
    };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: JwtHeader;
  let payload: JwtPayload;
  try {
    header = decodeBase64UrlJson<JwtHeader>(headerB64);
    payload = decodeBase64UrlJson<JwtPayload>(payloadB64);
  } catch {
    return {
      authenticated: false,
      email: null,
      mode: 'unauthenticated',
      error: 'Invalid JWT base64 encoding',
    };
  }

  if (header.alg !== 'RS256') {
    return {
      authenticated: false,
      email: null,
      mode: 'unauthenticated',
      error: `Unsupported JWT algorithm: ${header.alg}`,
    };
  }

  // Validate token expiration (exp)
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
    return {
      authenticated: false,
      email: null,
      mode: 'unauthenticated',
      error: 'JWT token has expired',
    };
  }

  // Validate audience (aud)
  const expectedAud = env.CF_ACCESS_AUD;
  if (expectedAud) {
    const tokenAud = payload.aud;
    const audMatches = Array.isArray(tokenAud)
      ? tokenAud.includes(expectedAud)
      : tokenAud === expectedAud;

    if (!audMatches) {
      return {
        authenticated: false,
        email: null,
        mode: 'unauthenticated',
        error: 'JWT audience (aud) mismatch',
      };
    }
  }

  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN;
  if (!teamDomain) {
    return {
      authenticated: false,
      email: null,
      mode: 'unauthenticated',
      error: 'CF_ACCESS_TEAM_DOMAIN is not configured',
    };
  }

  // Fetch Cloudflare Access public certificates (with JWKS caching)
  const certsUrl = `https://${teamDomain.replace(/^https?:\/\//, '')}/cdn-cgi/access/certs`;
  const { data: certsData, error: certsError } = await getCloudflareCerts(
    certsUrl,
    customFetch,
    header.kid
  );

  if (!certsData) {
    return {
      authenticated: false,
      email: null,
      mode: 'unauthenticated',
      error:
        certsError || 'Failed to retrieve Cloudflare Access certificates',
    };
  }

  const keys = Array.isArray(certsData?.keys) ? certsData.keys : [];
  const candidateKeys = header.kid
    ? keys.filter((k) => k.kid === header.kid)
    : keys;

  if (candidateKeys.length === 0) {
    return {
      authenticated: false,
      email: null,
      mode: 'unauthenticated',
      error: 'No matching JWK key ID (kid) found in Cloudflare Access certs',
    };
  }

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signatureBytes = base64UrlToUint8Array(signatureB64);

  for (const jwk of candidateKeys) {
    try {
      const cryptoKey = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify']
      );

      const isValid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        signatureBytes as BufferSource,
        signingInput as BufferSource
      );

      if (isValid) {
        return {
          authenticated: true,
          email: payload.email || 'authenticated@cloudflareaccess.com',
          mode: 'production-jwt',
        };
      }
    } catch {
      // Try next key if available
    }
  }

  return {
    authenticated: false,
    email: null,
    mode: 'unauthenticated',
    error: 'Invalid JWT cryptographic signature',
  };
}
