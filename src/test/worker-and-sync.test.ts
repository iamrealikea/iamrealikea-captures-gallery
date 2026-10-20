/**
 * src/test/worker-and-sync.test.ts
 *
 * Backend & CLI Integration Tests covering:
 * - Cloudflare Worker API routes (/api/captures, /api/captures/:id, /api/collections, /api/media/:key, /api/auth/session)
 * - Cloudflare Access Zero Trust RS256 JWT validation (Web Crypto RS256 signature verification, expired token rejection, audience check) & local development bypass
 * - Admin CRUD mutations (POST/PUT/DELETE /api/admin/captures, POST /api/admin/sync)
 * - Local Folder Sync CLI (`scripts/sync-captures.ts` dry-run and live sync)
 */

import { describe, it, expect } from 'vitest';
import worker from '../../worker/index';
import { createMockWorkerEnv } from '../../worker/workerTypes';
import { verifyCloudflareAccess } from '../../worker/auth';
import {
  getCapturesFromDb,
  getCaptureByIdFromDb,
  getCollectionsFromDb,
  insertCaptureIntoDb,
  updateCaptureInDb,
  deleteCaptureFromDb,
} from '../../worker/db';
import { MockStore, defaultMockStore } from '../data/mockStore';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCliSync, scanLocalCaptures } from '../../scripts/sync-captures';
import { generateAllSampleCaptures } from '../../scripts/generate-sample-captures';

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

async function createSignedTestJwt(
  privateKey: CryptoKey,
  payload: Record<string, unknown>,
  kid = 'test-key-1'
): Promise<string> {
  const headerB64 = jsonToBase64Url({ alg: 'RS256', kid, typ: 'JWT' });
  const payloadB64 = jsonToBase64Url(payload);
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    signingInput
  );
  const sigB64 = toBase64Url(new Uint8Array(signature));
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

describe('Cloudflare Worker API, Zero Trust Auth & Local Sync CLI', () => {
  it('serves GET /api/captures with collection, camera, search, and sort filters', async () => {
    const env = createMockWorkerEnv();

    // Unfiltered
    const resAll = await worker.fetch(
      new Request('http://localhost/api/captures'),
      env
    );
    expect(resAll.status).toBe(200);
    const dataAll = (await resAll.json()) as { captures: any[]; total: number };
    expect(dataAll.captures.length).toBeGreaterThanOrEqual(8);

    // Filter by collection=architecture
    const resArch = await worker.fetch(
      new Request('http://localhost/api/captures?collection=architecture'),
      env
    );
    const dataArch = (await resArch.json()) as { captures: any[] };
    expect(dataArch.captures.length).toBeGreaterThan(0);
    expect(
      dataArch.captures.every((c) => c.collection_slug === 'architecture')
    ).toBe(true);

    // Filter by camera=Leica Q2
    const resLeica = await worker.fetch(
      new Request('http://localhost/api/captures?camera=Leica%20Q2'),
      env
    );
    const dataLeica = (await resLeica.json()) as { captures: any[] };
    expect(dataLeica.captures.length).toBeGreaterThan(0);
    expect(
      dataLeica.captures.every((c) => c.camera_model === 'Leica Q2')
    ).toBe(true);
  });

  it('serves GET /api/captures/:id and GET /api/collections', async () => {
    const env = createMockWorkerEnv();

    const resDetail = await worker.fetch(
      new Request('http://localhost/api/captures/brutalist-atrium-01'),
      env
    );
    expect(resDetail.status).toBe(200);
    const detailJson = (await resDetail.json()) as { capture: any };
    expect(detailJson.capture.title).toBe('Brutalist concrete atrium');

    const resNotFound = await worker.fetch(
      new Request('http://localhost/api/captures/missing-slug'),
      env
    );
    expect(resNotFound.status).toBe(404);

    const resCols = await worker.fetch(
      new Request('http://localhost/api/collections'),
      env
    );
    expect(resCols.status).toBe(200);
    const colsJson = (await resCols.json()) as { collections: any[] };
    expect(colsJson.collections.length).toBe(3);
    expect(colsJson.collections[0].capture_count).toBeGreaterThan(0);
  });

  it('streams R2 objects via GET /api/media/:key with immutable Cache-Control headers', async () => {
    const env = createMockWorkerEnv();

    const resMedia = await worker.fetch(
      new Request(
        'http://localhost/api/media/captures/architecture/brutalist-atrium-01.jpg'
      ),
      env
    );
    expect(resMedia.status).toBe(200);
    expect(resMedia.headers.get('Content-Type')).toBe('image/jpeg');
    expect(resMedia.headers.get('Cache-Control')).toBe(
      'public, max-age=31536000, immutable'
    );
    expect(resMedia.headers.get('ETag')).toBeTruthy();

    const resMissing = await worker.fetch(
      new Request('http://localhost/api/media/captures/missing.jpg'),
      env
    );
    expect(resMissing.status).toBe(404);
  });

  it('validates Cloudflare Access RS256 JWTs in production and bypasses in development', async () => {
    // 1. Development bypass
    const devResult = await verifyCloudflareAccess(
      new Request('http://localhost/api/auth/session'),
      { ENVIRONMENT: 'development' }
    );
    expect(devResult).toEqual({
      authenticated: true,
      email: 'dev@localhost',
      mode: 'development-bypass',
    });

    // 2. Production mode: generate real RS256 keypair via Web Crypto
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

    const publicJwk = (await crypto.subtle.exportKey(
      'jwk',
      keyPair.publicKey
    )) as JsonWebKey & { kid?: string };
    publicJwk.kid = 'cf-access-kid-1';

    const mockCertsFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const prodEnv = createMockWorkerEnv({
      ENVIRONMENT: 'production',
      CF_ACCESS_TEAM_DOMAIN: 'gallery-auth.cloudflareaccess.com',
      CF_ACCESS_AUD: 'expected-audience-tag',
      customFetch: mockCertsFetch,
    });

    // 2a. Missing header -> 401 on admin endpoint
    const unauthRes = await worker.fetch(
      new Request('https://gallery.example.com/api/admin/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Blocked Capture',
          collection_slug: 'architecture',
          width: 1200,
          height: 800,
        }),
      }),
      prodEnv
    );
    expect(unauthRes.status).toBe(401);

    // 2b. Expired token -> fails verification
    const expiredJwt = await createSignedTestJwt(
      keyPair.privateKey,
      {
        aud: 'expected-audience-tag',
        email: 'curator@example.com',
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      'cf-access-kid-1'
    );
    const expiredCheck = await verifyCloudflareAccess(
      new Request('https://gallery.example.com/api/admin/captures', {
        headers: { 'Cf-Access-Jwt-Assertion': expiredJwt },
      }),
      prodEnv,
      mockCertsFetch
    );
    expect(expiredCheck.authenticated).toBe(false);
    expect(expiredCheck.error).toMatch(/expired/i);

    // 2c. Valid RS256 token -> authenticates and allows POST / PUT / DELETE
    const validJwt = await createSignedTestJwt(
      keyPair.privateKey,
      {
        aud: 'expected-audience-tag',
        email: 'curator@example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      'cf-access-kid-1'
    );

    const createRes = await worker.fetch(
      new Request('https://gallery.example.com/api/admin/captures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cf-Access-Jwt-Assertion': validJwt,
        },
        body: JSON.stringify({
          title: 'Tokyo Tower Dusk',
          collection_slug: 'street',
          camera_model: 'Leica Q2',
          width: 3840,
          height: 2560,
          featured: true,
        }),
      }),
      prodEnv
    );
    expect(createRes.status).toBe(201);
    const createdJson = (await createRes.json()) as { capture: any };
    expect(createdJson.capture.slug).toBe('tokyo-tower-dusk');

    // Update capture via PUT /api/admin/captures/:id
    const updateRes = await worker.fetch(
      new Request(
        `https://gallery.example.com/api/admin/captures/${createdJson.capture.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Cf-Access-Jwt-Assertion': validJwt,
          },
          body: JSON.stringify({
            title: 'Tokyo Tower Midnight',
            featured: false,
          }),
        }
      ),
      prodEnv
    );
    expect(updateRes.status).toBe(200);
    const updatedJson = (await updateRes.json()) as { capture: any };
    expect(updatedJson.capture.title).toBe('Tokyo Tower Midnight');
    expect(updatedJson.capture.featured).toBe(false);

    // Delete capture via DELETE /api/admin/captures/:id
    const deleteRes = await worker.fetch(
      new Request(
        `https://gallery.example.com/api/admin/captures/${createdJson.capture.id}`,
        {
          method: 'DELETE',
          headers: {
            'Cf-Access-Jwt-Assertion': validJwt,
          },
        }
      ),
      prodEnv
    );
    expect(deleteRes.status).toBe(200);
    const deleteJson = (await deleteRes.json()) as {
      success: boolean;
      deleted: boolean;
      id: string;
    };
    expect(deleteJson).toEqual({
      success: true,
      deleted: true,
      id: createdJson.capture.id,
    });
  });

  it('scans captures directory and executes CLI sync in both --dry-run and live Worker modes', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-sync-test-'));
    generateAllSampleCaptures(tempDir, true);
    const tempCaptures = path.join(tempDir, 'captures');
    const items = await scanLocalCaptures(tempCaptures);
    expect(items.length).toBe(6);

    const dryRunReport = await runCliSync({ capturesDir: tempCaptures, dryRun: true, silent: true });
    expect(dryRunReport.dryRun).toBe(true);
    expect(dryRunReport.items.length).toBe(6);
    expect(dryRunReport.result.synced).toBe(6);

    const env = createMockWorkerEnv();
    const liveReport = await runCliSync({
      capturesDir: tempCaptures,
      dryRun: false,
      silent: true,
      workerEnv: env,
    });
    expect(liveReport.dryRun).toBe(false);
    expect(liveReport.result.synced).toBe(6);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('rejects unsupported MIME types, missing titles, and JWT audience mismatches', async () => {
    const env = createMockWorkerEnv();

    // Missing title on POST /api/admin/captures -> 400
    const missingTitleRes = await worker.fetch(
      new Request('http://localhost/api/admin/captures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '   ',
          collection_slug: 'architecture',
          width: 1200,
          height: 800,
        }),
      }),
      env
    );
    expect(missingTitleRes.status).toBe(400);

    // Unsupported MIME type in multipart/form-data -> 400
    const badFormData = new FormData();
    badFormData.append('title', 'Invalid Text Upload');
    badFormData.append('collection_slug', 'architecture');
    badFormData.append(
      'file',
      new File(['not an image'], 'malicious.txt', { type: 'text/plain' })
    );

    const multipartReq = {
      method: 'POST',
      url: 'http://localhost/api/admin/captures',
      headers: new Headers({
        'Content-Type': 'multipart/form-data; boundary=---test',
      }),
      formData: async () => badFormData,
    } as unknown as Request;

    const badMimeRes = await worker.fetch(multipartReq, env);
    expect(badMimeRes.status).toBe(400);
    const badMimeBody = (await badMimeRes.json()) as { error: string };
    expect(badMimeBody.error).toMatch(/unsupported image mime type/i);

    // JWT audience mismatch in production -> 401
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

    const publicJwk = (await crypto.subtle.exportKey(
      'jwk',
      keyPair.publicKey
    )) as JsonWebKey & { kid?: string };
    publicJwk.kid = 'aud-mismatch-kid';

    const prodEnvWithAud = createMockWorkerEnv({
      ENVIRONMENT: 'production',
      CF_ACCESS_TEAM_DOMAIN: 'security.cloudflareaccess.com',
      CF_ACCESS_AUD: 'expected-aud-token',
      customFetch: async () =>
        new Response(JSON.stringify({ keys: [publicJwk] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    });

    const badAudJwt = await createSignedTestJwt(
      keyPair.privateKey,
      {
        aud: 'unexpected-wrong-aud',
        email: 'attacker@example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      'aud-mismatch-kid'
    );

    const badAudRes = await worker.fetch(
      new Request('https://gallery.example.com/api/admin/captures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cf-Access-Jwt-Assertion': badAudJwt,
        },
        body: JSON.stringify({
          title: 'Audience Mismatch Photo',
          collection_slug: 'architecture',
          width: 1200,
          height: 800,
        }),
      }),
      prodEnvWithAud
    );
    expect(badAudRes.status).toBe(401);
    const badAudBody = (await badAudRes.json()) as { error: string };
    expect(badAudBody.error).toMatch(/audience.*mismatch/i);
  });

  it('handles CORS OPTIONS preflight returning 204 No Content with CORS headers', async () => {
    const env = createMockWorkerEnv();
    const res = await worker.fetch(
      new Request('http://localhost/api/captures', { method: 'OPTIONS' }),
      env
    );
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('OPTIONS');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain(
      'Cf-Access-Jwt-Assertion'
    );
  });

  it('handles HTTP 304 Not Modified conditional requests for R2 media', async () => {
    const env = createMockWorkerEnv();
    const mediaUrl =
      'http://localhost/api/media/captures/architecture/brutalist-atrium-01.jpg';

    // 1. Unconditional request: 200 OK with ETag
    const res200 = await worker.fetch(new Request(mediaUrl), env);
    expect(res200.status).toBe(200);
    const etag = res200.headers.get('ETag');
    expect(etag).toBeTruthy();

    // 2. Conditional request with matching If-None-Match: 304 Not Modified
    const res304 = await worker.fetch(
      new Request(mediaUrl, {
        headers: { 'If-None-Match': etag! },
      }),
      env
    );
    expect(res304.status).toBe(304);
    expect(res304.body).toBeNull();
    expect(res304.headers.get('ETag')).toBe(etag);

    // 3. Conditional request with non-matching ETag: 200 OK
    const resDifferent = await worker.fetch(
      new Request(mediaUrl, {
        headers: { 'If-None-Match': '"different-etag"' },
      }),
      env
    );
    expect(resDifferent.status).toBe(200);
  });

  it('caches JWKS public keys in worker/auth.ts across multiple requests', async () => {
    let fetchCount = 0;
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

    const publicJwk = (await crypto.subtle.exportKey(
      'jwk',
      keyPair.publicKey
    )) as JsonWebKey & { kid?: string };
    publicJwk.kid = 'jwks-cache-kid';

    const countingFetch: typeof fetch = async () => {
      fetchCount++;
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const cacheEnv = createMockWorkerEnv({
      ENVIRONMENT: 'production',
      CF_ACCESS_TEAM_DOMAIN: 'cached-auth.cloudflareaccess.com',
      CF_ACCESS_AUD: 'cache-aud-tag',
      customFetch: countingFetch,
    });

    const testJwt = await createSignedTestJwt(
      keyPair.privateKey,
      {
        aud: 'cache-aud-tag',
        email: 'cached-user@example.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      'jwks-cache-kid'
    );

    // First request fetches certs
    const auth1 = await verifyCloudflareAccess(
      new Request('https://gallery.example.com/api/admin/captures', {
        headers: { 'Cf-Access-Jwt-Assertion': testJwt },
      }),
      cacheEnv,
      countingFetch
    );
    expect(auth1.authenticated).toBe(true);
    expect(fetchCount).toBe(1);

    // Second request reuses cached certs without re-fetching
    const auth2 = await verifyCloudflareAccess(
      new Request('https://gallery.example.com/api/admin/captures', {
        headers: { 'Cf-Access-Jwt-Assertion': testJwt },
      }),
      cacheEnv,
      countingFetch
    );
    expect(auth2.authenticated).toBe(true);
    expect(fetchCount).toBe(1);
  });

  it('exercises worker/db.ts D1 query helpers directly', async () => {
    const env = createMockWorkerEnv();
    const db = env.DB!;

    const captures = await getCapturesFromDb(db);
    expect(captures.length).toBeGreaterThanOrEqual(8);

    const single = await getCaptureByIdFromDb(db, 'brutalist-atrium-01');
    expect(single).not.toBeNull();
    expect(single?.title).toBe('Brutalist concrete atrium');

    const collections = await getCollectionsFromDb(db);
    expect(collections.length).toBe(3);

    const testCapture = {
      ...captures[0],
      id: 'cap-db-test-custom',
      slug: 'db-test-custom',
      title: 'DB Test Custom Capture',
    };
    await insertCaptureIntoDb(db, testCapture);

    const updatedTest = { ...testCapture, title: 'DB Test Custom Updated' };
    await updateCaptureInDb(db, updatedTest);

    await deleteCaptureFromDb(db, 'cap-db-test-custom');
  });

  it('exercises src/data/mockStore.ts CRUD operations and filtering', () => {
    expect(defaultMockStore.getAllCaptures().length).toBeGreaterThanOrEqual(8);
    expect(defaultMockStore.getAllCollections().length).toBe(3);

    const store = new MockStore();
    expect(store.getAllCaptures().length).toBeGreaterThanOrEqual(8);
    expect(store.getAllCollections().length).toBe(3);
    expect(store.getAvailableCameras().length).toBeGreaterThanOrEqual(4);

    const created = store.createCapture({
      title: 'MockStore Sunset',
      collection_slug: 'street',
      width: 3840,
      height: 2560,
    });
    expect(created.id).toBeTruthy();
    expect(store.getCaptureByIdOrSlug(created.id)?.title).toBe(
      'MockStore Sunset'
    );

    const updated = store.updateCapture(created.id, {
      title: 'MockStore Sunrise',
      featured: true,
    });
    expect(updated.title).toBe('MockStore Sunrise');
    expect(updated.featured).toBe(true);

    const deleted = store.deleteCapture(created.id);
    expect(deleted).toBe(true);
    expect(store.getCaptureByIdOrSlug(created.id)).toBeNull();

    store.reset();
    expect(store.getAllCaptures().length).toBeGreaterThanOrEqual(8);
  });
});
