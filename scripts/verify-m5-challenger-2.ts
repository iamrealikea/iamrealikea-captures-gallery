/**
 * scripts/verify-m5-challenger-2.ts
 *
 * Empirical verification harness for Milestone 5 Challenger 2:
 * 1. Cloudflare Access Zero Trust & Web Crypto RS256 validation + negative test vectors
 * 2. Worker endpoints & HTTP semantics (OPTIONS 204, R2 streaming / ETag / 304, D1 relational queries & in-memory fallback)
 * 3. Local Folder Sync CLI (--dry-run guarantees & corrupted image resilience)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import worker, { type WorkerEnv } from '../worker/index';
import { verifyCloudflareAccess, clearCertsCache } from '../worker/auth';
import { loadAllCaptures, loadAllCollections } from '../worker/db';
import { createMockWorkerEnv } from '../worker/workerTypes';
import { runCliSync, scanLocalCaptures } from './sync-captures';
import type { Capture } from '../src/types/gallery';

interface AssertionResult {
  category: string;
  test: string;
  passed: boolean;
  expected?: string;
  actual?: string;
  details?: string;
}

const results: AssertionResult[] = [];

function assert(
  category: string,
  test: string,
  passed: boolean,
  expected?: string,
  actual?: string,
  details?: string
) {
  results.push({
    category,
    test,
    passed,
    expected,
    actual,
    details,
  });
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonToBase64Url(obj: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
}

async function generateRsaKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  jwk: JsonWebKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey, jwk };
}

async function createSignedJwt(
  privateKey: CryptoKey,
  header: Record<string, unknown>,
  payload: Record<string, unknown>
): Promise<string> {
  const headerB64 = jsonToBase64Url(header);
  const payloadB64 = jsonToBase64Url(payload);
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, signingInput);
  const sigB64 = toBase64Url(new Uint8Array(sig));
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

async function runEmpiricalChallenge() {
  console.log('================================================================');
  console.log('CHALLENGER 2: EMPIRICAL VERIFICATION HARNESS — MILESTONE 5');
  console.log('Targets: Cloudflare Access Auth, Worker Semantics, D1/R2, Sync CLI');
  console.log('================================================================\n');

  // ============================================================================
  // Suite 1: Cloudflare Access Zero Trust & Web Crypto RS256 Validation
  // ============================================================================
  console.log('--- Suite 1: Cloudflare Access Zero Trust & Negative Vectors ---');
  clearCertsCache();

  const testAud = 'test-aud-1234567890abcdef1234567890abcdef';
  const teamDomain = 'test-team.cloudflareaccess.com';
  const { privateKey, jwk } = await generateRsaKeyPair();
  const testKid = 'key-id-primary-1';
  const testJwk: JsonWebKey & { kid?: string } = { ...jwk, kid: testKid };

  // Mock fetch for Cloudflare certs endpoint
  const certsUrl = `https://${teamDomain}/cdn-cgi/access/certs`;
  const mockFetch = (async (input: RequestInfo | URL) => {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr === certsUrl) {
      return new Response(JSON.stringify({ keys: [testJwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('Not Found', { status: 404 });
  }) as typeof fetch;

  const prodEnv: WorkerEnv = {
    ENVIRONMENT: 'production',
    CF_ACCESS_TEAM_DOMAIN: teamDomain,
    CF_ACCESS_AUD: testAud,
    customFetch: mockFetch,
  };

  const devEnv: WorkerEnv = {
    ENVIRONMENT: 'development',
    CF_ACCESS_TEAM_DOMAIN: teamDomain,
    CF_ACCESS_AUD: testAud,
  };

  // 1.1 Local development auth bypass
  {
    const req = new Request('http://localhost/api/auth/session');
    const authDev = await verifyCloudflareAccess(req, devEnv);
    assert(
      'Auth: Dev Bypass',
      'Dev environment bypasses auth and returns dev@localhost',
      authDev.authenticated === true &&
        authDev.email === 'dev@localhost' &&
        authDev.mode === 'development-bypass',
      'authenticated=true, email=dev@localhost, mode=development-bypass',
      `authenticated=${authDev.authenticated}, email=${authDev.email}, mode=${authDev.mode}`
    );
  }

  // 1.2 Production valid RS256 token
  {
    const now = Math.floor(Date.now() / 1000);
    const validJwt = await createSignedJwt(
      privateKey,
      { alg: 'RS256', kid: testKid, typ: 'JWT' },
      {
        aud: testAud,
        email: 'curator@example.com',
        exp: now + 3600,
        iat: now,
      }
    );

    const req = new Request('http://localhost/api/auth/session', {
      headers: { 'Cf-Access-Jwt-Assertion': validJwt },
    });
    const authProd = await verifyCloudflareAccess(req, prodEnv, mockFetch);
    assert(
      'Auth: Production RS256',
      'Valid RS256 JWT verifies successfully against JWKS certs',
      authProd.authenticated === true &&
        authProd.email === 'curator@example.com' &&
        authProd.mode === 'production-jwt',
      'authenticated=true, email=curator@example.com, mode=production-jwt',
      `authenticated=${authProd.authenticated}, email=${authProd.email}, mode=${authProd.mode}`
    );
  }

  // 1.3 Negative: Expired token
  {
    const now = Math.floor(Date.now() / 1000);
    const expiredJwt = await createSignedJwt(
      privateKey,
      { alg: 'RS256', kid: testKid, typ: 'JWT' },
      {
        aud: testAud,
        email: 'curator@example.com',
        exp: now - 120, // expired 2 mins ago
        iat: now - 3600,
      }
    );

    const req = new Request('http://localhost/api/auth/session', {
      headers: { 'Cf-Access-Jwt-Assertion': expiredJwt },
    });
    const authRes = await verifyCloudflareAccess(req, prodEnv, mockFetch);
    assert(
      'Auth: Negative Expired Token',
      'Expired token rejected with authenticated=false and expiration error',
      authRes.authenticated === false &&
        authRes.error?.includes('expired') === true,
      'authenticated=false, error contains "expired"',
      `authenticated=${authRes.authenticated}, error=${authRes.error}`
    );
  }

  // 1.4 Negative: Tampered signature
  {
    const now = Math.floor(Date.now() / 1000);
    const validJwt = await createSignedJwt(
      privateKey,
      { alg: 'RS256', kid: testKid, typ: 'JWT' },
      {
        aud: testAud,
        email: 'curator@example.com',
        exp: now + 3600,
        iat: now,
      }
    );
    const parts = validJwt.split('.');
    // Tamper the payload: replace base64 payload with another
    const tamperedPayloadB64 = jsonToBase64Url({
      aud: testAud,
      email: 'hacker@example.com',
      exp: now + 3600,
      iat: now,
    });
    const tamperedJwt = `${parts[0]}.${tamperedPayloadB64}.${parts[2]}`;

    const req = new Request('http://localhost/api/auth/session', {
      headers: { 'Cf-Access-Jwt-Assertion': tamperedJwt },
    });
    const authRes = await verifyCloudflareAccess(req, prodEnv, mockFetch);
    assert(
      'Auth: Negative Tampered Signature',
      'Tampered payload rejected with invalid signature error',
      authRes.authenticated === false &&
        authRes.error?.includes('signature') === true,
      'authenticated=false, error contains "signature"',
      `authenticated=${authRes.authenticated}, error=${authRes.error}`
    );
  }

  // 1.5 Negative: Audience mismatch
  {
    const now = Math.floor(Date.now() / 1000);
    const badAudJwt = await createSignedJwt(
      privateKey,
      { alg: 'RS256', kid: testKid, typ: 'JWT' },
      {
        aud: 'wrong-audience-id-99999',
        email: 'curator@example.com',
        exp: now + 3600,
        iat: now,
      }
    );

    const req = new Request('http://localhost/api/auth/session', {
      headers: { 'Cf-Access-Jwt-Assertion': badAudJwt },
    });
    const authRes = await verifyCloudflareAccess(req, prodEnv, mockFetch);
    assert(
      'Auth: Negative Audience Mismatch',
      'Token with mismatched audience rejected with aud mismatch error',
      authRes.authenticated === false &&
        authRes.error?.includes('audience') === true,
      'authenticated=false, error contains "audience"',
      `authenticated=${authRes.authenticated}, error=${authRes.error}`
    );
  }

  // 1.6 Negative: Missing token header in production
  {
    const req = new Request('http://localhost/api/auth/session');
    const authRes = await verifyCloudflareAccess(req, prodEnv, mockFetch);
    assert(
      'Auth: Negative Missing Header',
      'Missing token header in production returns authenticated=false',
      authRes.authenticated === false &&
        authRes.error?.includes('Missing') === true,
      'authenticated=false, error contains "Missing"',
      `authenticated=${authRes.authenticated}, error=${authRes.error}`
    );
  }

  // 1.7 Negative: Malformed JWT structure
  {
    const req = new Request('http://localhost/api/auth/session', {
      headers: { 'Cf-Access-Jwt-Assertion': 'invalid.jwt.with.too.many.dots' },
    });
    const authRes = await verifyCloudflareAccess(req, prodEnv, mockFetch);
    assert(
      'Auth: Negative Malformed Structure',
      'Malformed token rejected with structure error',
      authRes.authenticated === false &&
        authRes.error?.includes('Malformed') === true,
      'authenticated=false, error contains "Malformed"',
      `authenticated=${authRes.authenticated}, error=${authRes.error}`
    );
  }

  // 1.8 Negative: Unsupported algorithm (e.g. HS256)
  {
    const now = Math.floor(Date.now() / 1000);
    const hsHeader = jsonToBase64Url({ alg: 'HS256', kid: testKid });
    const payload = jsonToBase64Url({
      aud: testAud,
      email: 'curator@example.com',
      exp: now + 3600,
    });
    const fakeToken = `${hsHeader}.${payload}.fakesignature`;

    const req = new Request('http://localhost/api/auth/session', {
      headers: { 'Cf-Access-Jwt-Assertion': fakeToken },
    });
    const authRes = await verifyCloudflareAccess(req, prodEnv, mockFetch);
    assert(
      'Auth: Negative Unsupported Algorithm',
      'Non-RS256 algorithm rejected with unsupported algorithm error',
      authRes.authenticated === false &&
        authRes.error?.includes('Unsupported JWT algorithm') === true,
      'authenticated=false, error contains "Unsupported JWT algorithm"',
      `authenticated=${authRes.authenticated}, error=${authRes.error}`
    );
  }

  // 1.9 Cookie fallback CF_Authorization
  {
    const now = Math.floor(Date.now() / 1000);
    const validJwt = await createSignedJwt(
      privateKey,
      { alg: 'RS256', kid: testKid, typ: 'JWT' },
      {
        aud: testAud,
        email: 'cookie-user@example.com',
        exp: now + 3600,
        iat: now,
      }
    );

    const req = new Request('http://localhost/api/auth/session', {
      headers: {
        Cookie: `other_cookie=xyz; CF_Authorization=${validJwt}; session=abc`,
      },
    });
    const authRes = await verifyCloudflareAccess(req, prodEnv, mockFetch);
    assert(
      'Auth: Cookie CF_Authorization Fallback',
      'Cookie CF_Authorization accepted when Cf-Access-Jwt-Assertion header is absent',
      authRes.authenticated === true &&
        authRes.email === 'cookie-user@example.com',
      'authenticated=true, email=cookie-user@example.com',
      `authenticated=${authRes.authenticated}, email=${authRes.email}`
    );
  }

  // ============================================================================
  // Suite 2: Worker Endpoints & HTTP Semantics
  // ============================================================================
  console.log('\n--- Suite 2: Worker Endpoints & HTTP Semantics ---');
  const env = createMockWorkerEnv();

  // 2.1 OPTIONS preflight: HTTP 204 with null body and CORS headers
  {
    const optionsEndpoints = [
      'http://localhost/api/captures',
      'http://localhost/api/captures/cap-arch-01',
      'http://localhost/api/collections',
      'http://localhost/api/media/captures/architecture/brutalist-atrium-01.jpg',
      'http://localhost/api/auth/session',
      'http://localhost/api/admin/captures',
      'http://localhost/api/admin/sync',
    ];

    let allOptionsPassed = true;
    for (const ep of optionsEndpoints) {
      const res = await worker.fetch(new Request(ep, { method: 'OPTIONS' }), env);
      const bodyText = await res.text();
      const allowOrigin = res.headers.get('Access-Control-Allow-Origin');
      const allowMethods = res.headers.get('Access-Control-Allow-Methods');
      const allowHeaders = res.headers.get('Access-Control-Allow-Headers');
      const maxAge = res.headers.get('Access-Control-Max-Age');

      if (
        res.status !== 204 ||
        bodyText !== '' ||
        allowOrigin !== '*' ||
        !allowMethods?.includes('GET') ||
        !allowMethods?.includes('OPTIONS') ||
        !allowHeaders?.includes('Cf-Access-Jwt-Assertion') ||
        maxAge !== '86400'
      ) {
        allOptionsPassed = false;
        break;
      }
    }

    assert(
      'Worker: CORS OPTIONS Preflight',
      'All 7 API routes return HTTP 204 with null body and standard CORS headers',
      allOptionsPassed,
      'status=204, empty body, complete CORS headers',
      allOptionsPassed ? 'status=204 across all endpoints' : 'Preflight check failed'
    );
  }

  // 2.2 GET /api/media/:key streaming, Cache-Control, ETag, and HTTP 304 on If-None-Match
  {
    const mediaKey = 'captures/architecture/brutalist-atrium-01.jpg';
    const reqNormal = new Request(`http://localhost/api/media/${encodeURIComponent(mediaKey)}`);
    const resNormal = await worker.fetch(reqNormal, env);

    const normalStatus = resNormal.status;
    const contentType = resNormal.headers.get('Content-Type');
    const cacheControl = resNormal.headers.get('Cache-Control');
    const etag = resNormal.headers.get('ETag');
    const binaryData = await resNormal.arrayBuffer();

    assert(
      'Worker: R2 Media Streaming & Headers',
      'Streams media from R2 with Content-Type, immutable Cache-Control, and ETag',
      normalStatus === 200 &&
        contentType === 'image/jpeg' &&
        cacheControl === 'public, max-age=31536000, immutable' &&
        etag !== null &&
        etag.length > 0 &&
        binaryData.byteLength > 0,
      'status=200, Content-Type=image/jpeg, Cache-Control=public, max-age=31536000, immutable, non-empty ETag & body',
      `status=${normalStatus}, contentType=${contentType}, cacheControl=${cacheControl}, etag=${etag}, bytes=${binaryData.byteLength}`
    );

    // Test conditional GET with matching ETag
    if (etag) {
      // 1. Quoted matching ETag
      const reqMatchQuoted = new Request(
        `http://localhost/api/media/${encodeURIComponent(mediaKey)}`,
        { headers: { 'If-None-Match': etag } }
      );
      const res304Quoted = await worker.fetch(reqMatchQuoted, env);
      const body304Quoted = await res304Quoted.text();

      // 2. Unquoted matching ETag
      const unquoted = etag.replace(/^"|"$/g, '');
      const reqMatchUnquoted = new Request(
        `http://localhost/api/media/${encodeURIComponent(mediaKey)}`,
        { headers: { 'If-None-Match': unquoted } }
      );
      const res304Unquoted = await worker.fetch(reqMatchUnquoted, env);

      // 3. Wildcard If-None-Match: *
      const reqMatchWildcard = new Request(
        `http://localhost/api/media/${encodeURIComponent(mediaKey)}`,
        { headers: { 'If-None-Match': '*' } }
      );
      const res304Wildcard = await worker.fetch(reqMatchWildcard, env);

      // 4. Weak ETag If-None-Match: W/"..."
      const reqMatchWeak = new Request(
        `http://localhost/api/media/${encodeURIComponent(mediaKey)}`,
        { headers: { 'If-None-Match': `W/${etag}` } }
      );
      const res304Weak = await worker.fetch(reqMatchWeak, env);

      // 5. Non-matching ETag -> returns 200
      const reqNonMatch = new Request(
        `http://localhost/api/media/${encodeURIComponent(mediaKey)}`,
        { headers: { 'If-None-Match': '"different-etag-999"' } }
      );
      const res200NonMatch = await worker.fetch(reqNonMatch, env);

      assert(
        'Worker: HTTP 304 Not Modified',
        'If-None-Match returns HTTP 304 with null body for exact, unquoted, wildcard, and weak ETag variants',
        res304Quoted.status === 304 &&
          body304Quoted === '' &&
          res304Unquoted.status === 304 &&
          res304Wildcard.status === 304 &&
          res304Weak.status === 304 &&
          res200NonMatch.status === 200,
        'status=304 on matches with empty body, status=200 on mismatch',
        `quoted=${res304Quoted.status}, unquoted=${res304Unquoted.status}, wildcard=${res304Wildcard.status}, weak=${res304Weak.status}, nonMatch=${res200NonMatch.status}`
      );
    }

    // Media not found
    const resNotFound = await worker.fetch(
      new Request('http://localhost/api/media/captures/does-not-exist.jpg'),
      env
    );
    assert(
      'Worker: Media 404',
      'Non-existent media object returns HTTP 404 with JSON error',
      resNotFound.status === 404,
      'status=404',
      `status=${resNotFound.status}`
    );
  }

  // 2.3 D1 Relational Queries & Filtering
  {
    // GET /api/captures (unfiltered)
    const resAll = await worker.fetch(new Request('http://localhost/api/captures'), env);
    const dataAll = (await resAll.json()) as { captures: Capture[]; total: number };
    assert(
      'Worker: GET /api/captures',
      'Retrieves all captures and reports total count',
      resAll.status === 200 && dataAll.total >= 8 && dataAll.captures.length === dataAll.total,
      'status=200, total >= 8',
      `status=${resAll.status}, total=${dataAll.total}`
    );

    // Multi-criteria filter: collection + camera
    const resFiltered = await worker.fetch(
      new Request('http://localhost/api/captures?collection=architecture&camera=Leica%20Q2'),
      env
    );
    const dataFiltered = (await resFiltered.json()) as { captures: Capture[]; total: number };
    const allMatch = dataFiltered.captures.every(
      (c) => c.collection_slug === 'architecture' && c.camera_model === 'Leica Q2'
    );
    assert(
      'Worker: Relational Multi-Filter',
      'Filters captures by collection and camera simultaneously',
      resFiltered.status === 200 && dataFiltered.total > 0 && allMatch,
      'status=200, matches collection=architecture and camera=Leica Q2',
      `status=${resFiltered.status}, count=${dataFiltered.total}, allMatch=${allMatch}`
    );

    // Sorting: capture date descending
    const resSortedDate = await worker.fetch(
      new Request('http://localhost/api/captures?sort=captured_desc'),
      env
    );
    const dataSortedDate = (await resSortedDate.json()) as { captures: Capture[] };
    let dateInOrder = true;
    for (let i = 0; i < dataSortedDate.captures.length - 1; i++) {
      const d1 = new Date(dataSortedDate.captures[i].captured_at || 0).getTime();
      const d2 = new Date(dataSortedDate.captures[i + 1].captured_at || 0).getTime();
      if (d1 < d2) {
        dateInOrder = false;
        break;
      }
    }
    assert(
      'Worker: Sorting captured_desc',
      'Sorts captures by captured_at descending',
      dateInOrder,
      'strictly descending dates',
      `dateInOrder=${dateInOrder}`
    );

    // GET /api/collections with enrichment
    const resCollections = await worker.fetch(new Request('http://localhost/api/collections'), env);
    const dataCollections = (await resCollections.json()) as { collections: any[] };
    const hasCounts = dataCollections.collections.every(
      (c) =>
        typeof c.capture_count === 'number' &&
        c.capture_count > 0 &&
        (c.cover_capture_id || c.cover_image_url)
    );
    assert(
      'Worker: GET /api/collections',
      'Returns curated collections enriched with positive capture_count and cover_image_url',
      resCollections.status === 200 && dataCollections.collections.length === 3 && hasCounts,
      'status=200, 3 collections with counts and covers',
      `status=${resCollections.status}, count=${dataCollections.collections.length}, hasCounts=${hasCounts}`
    );

    // GET /api/captures/:id and slug
    const resById = await worker.fetch(new Request('http://localhost/api/captures/cap-brutalist-atrium-01'), env);
    const resBySlug = await worker.fetch(new Request('http://localhost/api/captures/brutalist-atrium-01'), env);
    assert(
      'Worker: GET /api/captures/:id and :slug',
      'Resolves capture by primary key ID and by slug',
      resById.status === 200 && resBySlug.status === 200,
      'both status=200',
      `byId=${resById.status}, bySlug=${resBySlug.status}`
    );
  }

  // 2.4 In-Memory Mock Store Fallback Resilience (when D1 is missing or fails)
  {
    // When env.DB is null/undefined
    const envNoDb: WorkerEnv = {
      ...env,
      DB: undefined,
    };
    const capturesNoDb = await loadAllCaptures(envNoDb);
    const collectionsNoDb = await loadAllCollections(envNoDb);
    assert(
      'Worker: Fallback when DB undefined',
      'loadAllCaptures and loadAllCollections gracefully fallback to seed data without crashing',
      capturesNoDb.length >= 8 && collectionsNoDb.length >= 3,
      'captures >= 8, collections >= 3 from seed fallback',
      `captures=${capturesNoDb.length}, collections=${collectionsNoDb.length}`
    );

    // When env.DB throws an error
    const brokenDb = {
      prepare() {
        throw new Error('D1 internal connection failure simulation');
      },
    } as unknown as D1Database;
    const envBrokenDb: WorkerEnv = {
      ...env,
      DB: brokenDb,
    };
    const capturesBrokenDb = await loadAllCaptures(envBrokenDb);
    const collectionsBrokenDb = await loadAllCollections(envBrokenDb);
    assert(
      'Worker: Fallback when DB throws',
      'loadAllCaptures and loadAllCollections catch database exceptions and return seed data',
      capturesBrokenDb.length >= 8 && collectionsBrokenDb.length >= 3,
      'captures >= 8, collections >= 3 from seed fallback',
      `captures=${capturesBrokenDb.length}, collections=${collectionsBrokenDb.length}`
    );
  }

  // 2.5 Admin Endpoints Protection & Validation
  {
    const prodWorkerEnv: WorkerEnv = {
      ...env,
      ENVIRONMENT: 'production',
      CF_ACCESS_TEAM_DOMAIN: teamDomain,
      CF_ACCESS_AUD: testAud,
      customFetch: mockFetch,
    };

    // Unauthenticated POST /api/admin/captures in production -> 401
    const resUnauthPost = await worker.fetch(
      new Request('http://localhost/api/admin/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Unauthorized' }),
      }),
      prodWorkerEnv
    );
    assert(
      'Admin Auth: Reject Unauthenticated Mutation',
      'POST /api/admin/captures without JWT returns HTTP 401 in production',
      resUnauthPost.status === 401,
      'status=401',
      `status=${resUnauthPost.status}`
    );

    // Validation: Missing title -> 400
    const resNoTitle = await worker.fetch(
      new Request('http://localhost/api/admin/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '   ', collection_slug: 'architecture' }),
      }),
      env // dev mode bypass
    );
    assert(
      'Admin Validation: Blank Title',
      'POST /api/admin/captures with blank title returns HTTP 400',
      resNoTitle.status === 400,
      'status=400',
      `status=${resNoTitle.status}`
    );

    // Validation: Missing collection_slug -> 400
    const resNoCol = await worker.fetch(
      new Request('http://localhost/api/admin/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Valid Title', collection_slug: '   ' }),
      }),
      env
    );
    assert(
      'Admin Validation: Missing Collection',
      'POST /api/admin/captures with empty collection_slug returns HTTP 400',
      resNoCol.status === 400,
      'status=400',
      `status=${resNoCol.status}`
    );

    // Validation: Unsupported MIME type -> 400
    const resBadMime = await worker.fetch(
      new Request('http://localhost/api/admin/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Valid Title',
          collection_slug: 'architecture',
          mime_type: 'image/gif',
        }),
      }),
      env
    );
    assert(
      'Admin Validation: Unsupported MIME',
      'POST /api/admin/captures with image/gif returns HTTP 400',
      resBadMime.status === 400,
      'status=400',
      `status=${resBadMime.status}`
    );

    // Validation: Exceeds 25MB -> 400
    const resOversize = await worker.fetch(
      new Request('http://localhost/api/admin/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Valid Title',
          collection_slug: 'architecture',
          file_size: 26 * 1024 * 1024,
        }),
      }),
      env
    );
    assert(
      'Admin Validation: Oversize File',
      'POST /api/admin/captures with file_size > 25MB returns HTTP 400',
      resOversize.status === 400,
      'status=400',
      `status=${resOversize.status}`
    );

    // PUT non-existent capture -> 404
    const resPutNotFound = await worker.fetch(
      new Request('http://localhost/api/admin/captures/non-existent-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      }),
      env
    );
    assert(
      'Admin PUT: Non-existent Capture',
      'PUT /api/admin/captures/:id for non-existent id returns HTTP 404',
      resPutNotFound.status === 404,
      'status=404',
      `status=${resPutNotFound.status}`
    );

    // DELETE non-existent capture -> 404
    const resDelNotFound = await worker.fetch(
      new Request('http://localhost/api/admin/captures/non-existent-id', {
        method: 'DELETE',
      }),
      env
    );
    assert(
      'Admin DELETE: Non-existent Capture',
      'DELETE /api/admin/captures/:id for non-existent id returns HTTP 404',
      resDelNotFound.status === 404,
      'status=404',
      `status=${resDelNotFound.status}`
    );

    // POST /api/admin/sync with malformed JSON -> 400
    const resSyncBadJson = await worker.fetch(
      new Request('http://localhost/api/admin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ malformed json: not valid }',
      }),
      env
    );
    assert(
      'Admin Sync: Malformed JSON',
      'POST /api/admin/sync with malformed JSON returns HTTP 400',
      resSyncBadJson.status === 400,
      'status=400',
      `status=${resSyncBadJson.status}`
    );
  }

  // ============================================================================
  // Suite 3: Local Folder Sync CLI & Image Resilience Stress Testing
  // ============================================================================
  console.log('\n--- Suite 3: Local Folder Sync CLI & Image Resilience Stress Testing ---');

  // 3.1 CLI Dry-Run Guarantees
  {
    const mockEnv = createMockWorkerEnv();
    const initialCapturesCount = mockEnv._capturesStore.size;
    const initialR2Count = mockEnv._r2Store.size;

    const dryRunReport = await runCliSync({
      dryRun: true,
      silent: true,
      workerEnv: mockEnv,
    });

    assert(
      'Sync CLI: Dry-Run Result Contract',
      'runCliSync({ dryRun: true }) reports 6 scanned, 0 inserted, 0 updated',
      dryRunReport.dryRun === true &&
        dryRunReport.items.length === 6 &&
        dryRunReport.result.synced === 6 &&
        dryRunReport.result.inserted === 0 &&
        dryRunReport.result.updated === 0,
      'dryRun=true, items=6, synced=6, inserted=0, updated=0',
      `dryRun=${dryRunReport.dryRun}, items=${dryRunReport.items.length}, synced=${dryRunReport.result.synced}, inserted=${dryRunReport.result.inserted}`
    );

    assert(
      'Sync CLI: Dry-Run Zero Mutation Invariant',
      'Verifies zero mutations in database store and R2 storage during dry-run',
      mockEnv._capturesStore.size === initialCapturesCount &&
        mockEnv._r2Store.size === initialR2Count,
      `dbSize=${initialCapturesCount}, r2Size=${initialR2Count}`,
      `dbSize=${mockEnv._capturesStore.size}, r2Size=${mockEnv._r2Store.size}`
    );
  }

  // 3.2 Corrupted and Adversarial Image Handling in Local Sync Scanner
  {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'captures-adversarial-'));
    try {
      const colDir = path.join(tempDir, 'experimental-adversarial');
      fs.mkdirSync(colDir, { recursive: true });

      // Vector A: 0-byte image file
      fs.writeFileSync(path.join(colDir, 'zero-byte.jpg'), Buffer.alloc(0));

      // Vector B: Random garbage bytes
      fs.writeFileSync(path.join(colDir, 'random-garbage.jpg'), crypto.randomBytes(512));

      // Vector C: Truncated JPEG (starts with 0xFF 0xD8 then immediately truncated)
      fs.writeFileSync(path.join(colDir, 'truncated.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe1]));

      // Vector D: Plain text masquerading as JPEG
      fs.writeFileSync(path.join(colDir, 'fake-jpeg.jpg'), Buffer.from('This is a text file not an image'));

      // Vector E: Unsupported file extension (should be ignored by scanner)
      fs.writeFileSync(path.join(colDir, 'readme.txt'), Buffer.from('Documentation notes'));
      fs.writeFileSync(path.join(colDir, 'metadata.json'), Buffer.from('{"key": "value"}'));

      // Vector F: Empty subdirectory
      fs.mkdirSync(path.join(tempDir, 'empty-collection'), { recursive: true });

      // Run scanLocalCaptures on the adversarial directory
      let scanThrew = false;
      let scannedItems: any[] = [];
      try {
        scannedItems = await scanLocalCaptures(tempDir);
      } catch (err) {
        scanThrew = true;
      }

      assert(
        'Sync CLI: Corrupted Image Resilience',
        'scanLocalCaptures processes corrupted, truncated, and zero-byte files without throwing',
        !scanThrew && scannedItems.length === 4,
        'scanThrew=false, scannedItems=4 (only the 4 .jpg files, ignoring .txt/.json)',
        `scanThrew=${scanThrew}, scannedItems=${scannedItems.length}`
      );

      // Verify that every corrupted item had safe fallback metadata populated
      const allSafeFallbacks = scannedItems.every(
        (item) =>
          typeof item.slug === 'string' &&
          typeof item.title === 'string' &&
          typeof item.r2_key === 'string' &&
          item.exif !== undefined
      );

      assert(
        'Sync CLI: Safe Fallbacks on Corrupted Files',
        'All corrupted images produced valid BatchSyncItem objects with safe defaults',
        allSafeFallbacks,
        'allSafeFallbacks=true',
        `allSafeFallbacks=${allSafeFallbacks}`
      );

      // Test runCliSync in dry-run mode on the adversarial directory
      const adversarialMockEnv = createMockWorkerEnv();
      let dryRunThrew = false;
      try {
        await runCliSync({
          capturesDir: tempDir,
          dryRun: true,
          silent: true,
          workerEnv: adversarialMockEnv,
        });
      } catch {
        dryRunThrew = true;
      }

      assert(
        'Sync CLI: Dry-Run on Adversarial Dir',
        'runCliSync --dry-run completes successfully on directory of corrupted images',
        !dryRunThrew,
        'dryRunThrew=false',
        `dryRunThrew=${dryRunThrew}`
      );
    } finally {
      // Clean up tempDir
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  // ============================================================================
  // Summary & Assertion Results
  // ============================================================================
  console.log('\n================================================================');
  console.log('CHALLENGER 2 EMPIRICAL VERIFICATION REPORT SUMMARY');
  console.log('================================================================');

  let passedCount = 0;
  let failedCount = 0;

  for (const r of results) {
    if (r.passed) {
      passedCount++;
      console.log(`  [PASS] ${r.category}: ${r.test}`);
    } else {
      failedCount++;
      console.log(`  [FAIL] ${r.category}: ${r.test}`);
      console.log(`         Expected: ${r.expected}`);
      console.log(`         Actual  : ${r.actual}`);
      if (r.details) console.log(`         Details : ${r.details}`);
    }
  }

  console.log('----------------------------------------------------------------');
  console.log(`Total Assertions: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runEmpiricalChallenge().catch((err) => {
  console.error('Unhandled fatal error in empirical verification harness:', err);
  process.exit(1);
});
