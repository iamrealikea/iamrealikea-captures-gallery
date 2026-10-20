/**
 * scripts/verify-m2-challenger-1.ts
 *
 * Empirical verification harness for Milestone 2 Challenger 1:
 * Cloudflare Worker API routes and HTTP semantics:
 * 1. CORS OPTIONS preflight: verify HTTP 204 with null body and CORS headers.
 * 2. HTTP 304 conditional request handling on `GET /api/media/:key`: verify matching `If-None-Match` returns 304 without body.
 * 3. `GET /api/captures` with various filter combinations (search query, camera model, collection, sort order).
 * 4. `GET /api/captures/:id` by ID and slug.
 * 5. `DELETE /api/admin/captures/:id`: verify response contains `{ success: true, id }`.
 */

import worker from '../worker/index';
import { createMockWorkerEnv } from '../worker/workerTypes';
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

async function runEmpiricalChallenge() {
  console.log('===============================================================');
  console.log('CHALLENGER 1: EMPIRICAL VERIFICATION HARNESS — MILESTONE 2');
  console.log('Target: Cloudflare Worker API Routes & HTTP Semantics');
  console.log('===============================================================\n');

  // ==========================================================================
  // 1. CORS OPTIONS Preflight Verification
  // ==========================================================================
  console.log('--- Suite 1: CORS OPTIONS Preflight Verification ---');
  const env = createMockWorkerEnv();

  const endpointsToTest = [
    'http://localhost/api/captures',
    'http://localhost/api/captures/cap-arch-01',
    'http://localhost/api/collections',
    'http://localhost/api/media/captures/architecture/brutalist-atrium-01.jpg',
    'http://localhost/api/auth/session',
    'http://localhost/api/admin/captures',
    'http://localhost/api/admin/captures/cap-arch-01',
    'http://localhost/api/admin/sync',
  ];

  for (const endpoint of endpointsToTest) {
    const preflightReq = new Request(endpoint, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://curator.example.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Cf-Access-Jwt-Assertion',
      },
    });

    const res = await worker.fetch(preflightReq, env);

    assert(
      'CORS OPTIONS Preflight',
      `OPTIONS ${new URL(endpoint).pathname} returns status 204`,
      res.status === 204,
      '204',
      String(res.status)
    );

    assert(
      'CORS OPTIONS Preflight',
      `OPTIONS ${new URL(endpoint).pathname} has null body`,
      res.body === null,
      'null',
      res.body === null ? 'null' : 'non-null'
    );

    const bodyText = await res.text();
    assert(
      'CORS OPTIONS Preflight',
      `OPTIONS ${new URL(endpoint).pathname} body text is empty`,
      bodyText === '',
      '""',
      `"${bodyText}"`
    );

    const allowOrigin = res.headers.get('Access-Control-Allow-Origin');
    assert(
      'CORS OPTIONS Preflight',
      `OPTIONS ${new URL(endpoint).pathname} has Access-Control-Allow-Origin: *`,
      allowOrigin === '*',
      '*',
      allowOrigin || 'missing'
    );

    const allowMethods = res.headers.get('Access-Control-Allow-Methods') || '';
    const hasRequiredMethods =
      allowMethods.includes('GET') &&
      allowMethods.includes('POST') &&
      allowMethods.includes('PUT') &&
      allowMethods.includes('DELETE') &&
      allowMethods.includes('OPTIONS');
    assert(
      'CORS OPTIONS Preflight',
      `OPTIONS ${new URL(endpoint).pathname} allows GET, POST, PUT, DELETE, OPTIONS`,
      hasRequiredMethods,
      'GET, POST, PUT, DELETE, OPTIONS',
      allowMethods
    );

    const allowHeaders = res.headers.get('Access-Control-Allow-Headers') || '';
    const hasRequiredHeaders =
      allowHeaders.includes('Content-Type') &&
      allowHeaders.includes('Cf-Access-Jwt-Assertion') &&
      allowHeaders.includes('Authorization');
    assert(
      'CORS OPTIONS Preflight',
      `OPTIONS ${new URL(endpoint).pathname} allows required request headers`,
      hasRequiredHeaders,
      'Content-Type, Cf-Access-Jwt-Assertion, Authorization',
      allowHeaders
    );

    const maxAge = res.headers.get('Access-Control-Max-Age');
    assert(
      'CORS OPTIONS Preflight',
      `OPTIONS ${new URL(endpoint).pathname} includes Access-Control-Max-Age`,
      maxAge === '86400',
      '86400',
      maxAge || 'missing'
    );
  }

  // ==========================================================================
  // 2. HTTP 304 Conditional Request Handling on GET /api/media/:key
  // ==========================================================================
  console.log('--- Suite 2: HTTP 304 Conditional Request Handling on /api/media/:key ---');
  const mediaKey = 'captures/architecture/brutalist-atrium-01.jpg';
  const mediaUrl = `http://localhost/api/media/${mediaKey}`;

  // 2.1 Unconditional GET
  const unconditionalRes = await worker.fetch(new Request(mediaUrl), env);
  assert(
    'HTTP 304 & Media Streaming',
    'Unconditional GET /api/media/:key returns 200 OK',
    unconditionalRes.status === 200,
    '200',
    String(unconditionalRes.status)
  );

  const etag = unconditionalRes.headers.get('ETag');
  assert(
    'HTTP 304 & Media Streaming',
    'Unconditional response contains valid ETag',
    Boolean(etag && etag.length > 0),
    'Non-empty ETag',
    etag || 'null'
  );

  const cacheControl = unconditionalRes.headers.get('Cache-Control');
  assert(
    'HTTP 304 & Media Streaming',
    'Unconditional response contains immutable Cache-Control',
    cacheControl === 'public, max-age=31536000, immutable',
    'public, max-age=31536000, immutable',
    cacheControl || 'null'
  );

  const unconditionalBytes = await unconditionalRes.arrayBuffer();
  assert(
    'HTTP 304 & Media Streaming',
    'Unconditional response returns payload bytes',
    unconditionalBytes.byteLength > 0,
    '> 0 bytes',
    `${unconditionalBytes.byteLength} bytes`
  );

  // 2.2 Conditional GET with exact ETag match
  if (etag) {
    const res304Exact = await worker.fetch(
      new Request(mediaUrl, {
        headers: { 'If-None-Match': etag },
      }),
      env
    );
    assert(
      'HTTP 304 & Media Streaming',
      'Matching If-None-Match returns HTTP 304 Not Modified',
      res304Exact.status === 304,
      '304',
      String(res304Exact.status)
    );

    assert(
      'HTTP 304 & Media Streaming',
      'HTTP 304 response has null body',
      res304Exact.body === null,
      'null',
      res304Exact.body === null ? 'null' : 'non-null'
    );

    const body304Text = await res304Exact.text();
    assert(
      'HTTP 304 & Media Streaming',
      'HTTP 304 response text is empty',
      body304Text === '',
      '""',
      `"${body304Text}"`
    );

    assert(
      'HTTP 304 & Media Streaming',
      'HTTP 304 response preserves ETag header',
      res304Exact.headers.get('ETag') === etag,
      etag,
      res304Exact.headers.get('ETag') || 'null'
    );

    assert(
      'HTTP 304 & Media Streaming',
      'HTTP 304 response preserves Cache-Control header',
      res304Exact.headers.get('Cache-Control') === 'public, max-age=31536000, immutable',
      'public, max-age=31536000, immutable',
      res304Exact.headers.get('Cache-Control') || 'null'
    );

    // 2.3 Conditional GET with wildcard '*'
    const res304Wildcard = await worker.fetch(
      new Request(mediaUrl, {
        headers: { 'If-None-Match': '*' },
      }),
      env
    );
    assert(
      'HTTP 304 & Media Streaming',
      'If-None-Match: * returns HTTP 304 Not Modified with null body',
      res304Wildcard.status === 304 && res304Wildcard.body === null,
      '304 & null body',
      `${res304Wildcard.status} & ${res304Wildcard.body === null ? 'null body' : 'body'}`
    );

    // 2.4 Conditional GET with weak validator format W/<etag>
    const weakEtag = etag.startsWith('W/') ? etag : `W/${etag}`;
    const res304Weak = await worker.fetch(
      new Request(mediaUrl, {
        headers: { 'If-None-Match': weakEtag },
      }),
      env
    );
    assert(
      'HTTP 304 & Media Streaming',
      'Weak validator If-None-Match (W/...) returns HTTP 304 Not Modified',
      res304Weak.status === 304 && res304Weak.body === null,
      '304 & null body',
      `${res304Weak.status} & ${res304Weak.body === null ? 'null body' : 'body'}`
    );

    // 2.5 Conditional GET with surrounding whitespace
    const res304Trimmed = await worker.fetch(
      new Request(mediaUrl, {
        headers: { 'If-None-Match': `   ${etag}   ` },
      }),
      env
    );
    assert(
      'HTTP 304 & Media Streaming',
      'If-None-Match with surrounding whitespace returns HTTP 304',
      res304Trimmed.status === 304 && res304Trimmed.body === null,
      '304 & null body',
      `${res304Trimmed.status} & ${res304Trimmed.body === null ? 'null body' : 'body'}`
    );

    // 2.6 Conditional GET with non-matching ETag -> 200 OK
    const res200Mismatch = await worker.fetch(
      new Request(mediaUrl, {
        headers: { 'If-None-Match': '"different-unmatched-etag-12345"' },
      }),
      env
    );
    assert(
      'HTTP 304 & Media Streaming',
      'Non-matching If-None-Match returns HTTP 200 OK with payload',
      res200Mismatch.status === 200,
      '200',
      String(res200Mismatch.status)
    );
    const mismatchBytes = await res200Mismatch.arrayBuffer();
    assert(
      'HTTP 304 & Media Streaming',
      'Non-matching If-None-Match returns non-empty payload',
      mismatchBytes.byteLength > 0,
      '> 0 bytes',
      `${mismatchBytes.byteLength} bytes`
    );
  }

  // 2.7 Edge case: Missing media key -> 400
  const missingKeyRes = await worker.fetch(
    new Request('http://localhost/api/media/'),
    env
  );
  assert(
    'HTTP 304 & Media Streaming',
    'GET /api/media/ with empty key returns 400 Bad Request',
    missingKeyRes.status === 400,
    '400',
    String(missingKeyRes.status)
  );

  // 2.8 Edge case: Non-existent media key -> 404
  const missingObjectRes = await worker.fetch(
    new Request('http://localhost/api/media/nonexistent/file.jpg'),
    env
  );
  assert(
    'HTTP 304 & Media Streaming',
    'GET /api/media/nonexistent/file.jpg returns 404 Not Found',
    missingObjectRes.status === 404,
    '404',
    String(missingObjectRes.status)
  );

  // ==========================================================================
  // 3. GET /api/captures Filter Combinations & Sorting
  // ==========================================================================
  console.log('--- Suite 3: GET /api/captures Filter Combinations & Sorting ---');

  // 3.1 Unfiltered captures
  const allCapturesRes = await worker.fetch(
    new Request('http://localhost/api/captures'),
    env
  );
  assert(
    'GET /api/captures',
    'Unfiltered GET /api/captures returns status 200',
    allCapturesRes.status === 200,
    '200',
    String(allCapturesRes.status)
  );
  const allData = (await allCapturesRes.json()) as { captures: Capture[]; total: number };
  assert(
    'GET /api/captures',
    'Unfiltered captures count >= 8 and total matches array length',
    allData.captures.length >= 8 && allData.total === allData.captures.length,
    `>= 8 captures and total === len`,
    `total: ${allData.total}, len: ${allData.captures.length}`
  );

  // 3.2 Collection filters
  const collections = ['architecture', 'street', 'minimalism'];
  for (const col of collections) {
    const colRes = await worker.fetch(
      new Request(`http://localhost/api/captures?collection=${col}`),
      env
    );
    const colData = (await colRes.json()) as { captures: Capture[]; total: number };
    const allMatch = colData.captures.length > 0 && colData.captures.every((c) => c.collection_slug === col);
    assert(
      'GET /api/captures Filtering',
      `Filter collection=${col} matches only ${col} items`,
      allMatch,
      `all collection_slug === ${col}`,
      `count: ${colData.captures.length}, allMatch: ${allMatch}`
    );
  }

  // 3.3 Camera filters
  const cameras = ['Leica Q2', 'Sony A7R V', 'Fujifilm X-T5', 'Hasselblad 907X 50C'];
  for (const cam of cameras) {
    const camRes = await worker.fetch(
      new Request(`http://localhost/api/captures?camera=${encodeURIComponent(cam)}`),
      env
    );
    const camData = (await camRes.json()) as { captures: Capture[]; total: number };
    const allMatch =
      camData.captures.length > 0 &&
      camData.captures.every(
        (c) =>
          (c.camera_model && c.camera_model.includes(cam)) ||
          (c.lens_model && c.lens_model.includes(cam))
      );
    assert(
      'GET /api/captures Filtering',
      `Filter camera=${cam} matches camera or lens model`,
      allMatch,
      `all camera/lens include ${cam}`,
      `count: ${camData.captures.length}, allMatch: ${allMatch}`
    );
  }

  // 3.4 Search query filters across different fields
  const searchCases = [
    { query: 'concrete', expectedField: 'story or title or tags' },
    { query: 'Tokyo', expectedField: 'location or title' },
    { query: 'Shibuya', expectedField: 'location' },
    { query: 'Monochrome', expectedField: 'story, title, or tags' },
    { query: 'BRUTALIST', expectedField: 'case-insensitive title' },
  ];

  for (const sc of searchCases) {
    const searchRes = await worker.fetch(
      new Request(`http://localhost/api/captures?search=${encodeURIComponent(sc.query)}`),
      env
    );
    const searchData = (await searchRes.json()) as { captures: Capture[]; total: number };
    assert(
      'GET /api/captures Search',
      `Search query "${sc.query}" returns non-empty matched results`,
      searchData.captures.length > 0,
      '> 0 captures',
      `${searchData.captures.length} captures`
    );
  }

  // Search query with zero matches
  const zeroSearchRes = await worker.fetch(
    new Request('http://localhost/api/captures?search=unmatchable_string_xyz_9999'),
    env
  );
  const zeroData = (await zeroSearchRes.json()) as { captures: Capture[]; total: number };
  assert(
    'GET /api/captures Search',
    'Search for non-existent term returns empty array with total 0',
    zeroData.captures.length === 0 && zeroData.total === 0,
    'total: 0, captures: []',
    `total: ${zeroData.total}, captures: ${zeroData.captures.length}`
  );

  // 3.5 Sort order testing
  // 3.5a sort=featured: featured items must precede non-featured items
  const featuredSortRes = await worker.fetch(
    new Request('http://localhost/api/captures?sort=featured'),
    env
  );
  const featuredData = (await featuredSortRes.json()) as { captures: Capture[] };
  let sawUnfeatured = false;
  let featuredOrderValid = true;
  for (const c of featuredData.captures) {
    if (!c.featured) {
      sawUnfeatured = true;
    } else if (sawUnfeatured) {
      featuredOrderValid = false;
      break;
    }
  }
  assert(
    'GET /api/captures Sorting',
    'sort=featured puts all featured: true captures before featured: false',
    featuredOrderValid && featuredData.captures.some((c) => c.featured),
    'featured captures first',
    `valid: ${featuredOrderValid}`
  );

  // 3.5b sort=captured_desc: captured_at descending
  const capturedSortRes = await worker.fetch(
    new Request('http://localhost/api/captures?sort=captured_desc'),
    env
  );
  const capturedData = (await capturedSortRes.json()) as { captures: Capture[] };
  let capturedOrderValid = true;
  for (let i = 1; i < capturedData.captures.length; i++) {
    const prevDate = Date.parse(capturedData.captures[i - 1].captured_at || '');
    const currDate = Date.parse(capturedData.captures[i].captured_at || '');
    if (prevDate < currDate) {
      capturedOrderValid = false;
      break;
    }
  }
  assert(
    'GET /api/captures Sorting',
    'sort=captured_desc orders strictly by captured_at descending',
    capturedOrderValid,
    'captured_at monotonic descending',
    `valid: ${capturedOrderValid}`
  );

  // 3.5c sort=created_desc: created_at descending
  const createdSortRes = await worker.fetch(
    new Request('http://localhost/api/captures?sort=created_desc'),
    env
  );
  const createdData = (await createdSortRes.json()) as { captures: Capture[] };
  let createdOrderValid = true;
  for (let i = 1; i < createdData.captures.length; i++) {
    const prevCreated = Date.parse(createdData.captures[i - 1].created_at || '');
    const currCreated = Date.parse(createdData.captures[i].created_at || '');
    if (prevCreated < currCreated) {
      createdOrderValid = false;
      break;
    }
  }
  assert(
    'GET /api/captures Sorting',
    'sort=created_desc orders strictly by created_at descending',
    createdOrderValid,
    'created_at monotonic descending',
    `valid: ${createdOrderValid}`
  );

  // 3.6 Multi-filter combination: collection + camera + search + sort
  const combinedRes = await worker.fetch(
    new Request(
      'http://localhost/api/captures?collection=architecture&camera=Leica%20Q2&search=concrete&sort=featured'
    ),
    env
  );
  const combinedData = (await combinedRes.json()) as { captures: Capture[]; total: number };
  const allCombinedMatch =
    combinedData.captures.length > 0 &&
    combinedData.captures.every(
      (c) =>
        c.collection_slug === 'architecture' &&
        (c.camera_model?.includes('Leica Q2') || c.lens_model?.includes('Leica Q2'))
    );
  assert(
    'GET /api/captures Combinations',
    'Combined collection + camera + search + sort filters resolve accurately',
    allCombinedMatch,
    'Matches all criteria',
    `count: ${combinedData.captures.length}, allMatch: ${allCombinedMatch}`
  );

  // Contradictory filters (e.g. collection=street but search term only in architecture)
  const contradictoryRes = await worker.fetch(
    new Request(
      'http://localhost/api/captures?collection=street&search=brutalist'
    ),
    env
  );
  const contradictoryData = (await contradictoryRes.json()) as {
    captures: Capture[];
    total: number;
  };
  assert(
    'GET /api/captures Combinations',
    'Contradictory filters return empty array and total: 0',
    contradictoryData.captures.length === 0 && contradictoryData.total === 0,
    'total: 0, captures: []',
    `total: ${contradictoryData.total}, captures: ${contradictoryData.captures.length}`
  );

  // ==========================================================================
  // 4. GET /api/captures/:id Resolution by ID and Slug
  // ==========================================================================
  console.log('--- Suite 4: GET /api/captures/:id Resolution by ID and Slug ---');

  // Sample capture from seed: brutalist-atrium-01
  const targetSlug = 'brutalist-atrium-01';
  let targetId = '';

  // 4.1 Lookup by slug with DB present
  const resBySlugDb = await worker.fetch(
    new Request(`http://localhost/api/captures/${targetSlug}`),
    env
  );
  assert(
    'GET /api/captures/:id',
    `GET /api/captures/:slug (${targetSlug}) returns status 200`,
    resBySlugDb.status === 200,
    '200',
    String(resBySlugDb.status)
  );
  const jsonBySlugDb = (await resBySlugDb.json()) as { capture: Capture };
  assert(
    'GET /api/captures/:id',
    'Lookup by slug returns expected title',
    jsonBySlugDb.capture.title === 'Brutalist concrete atrium',
    'Brutalist concrete atrium',
    jsonBySlugDb.capture?.title || 'null'
  );
  targetId = jsonBySlugDb.capture.id;

  // 4.2 Lookup by ID with DB present
  const resByIdDb = await worker.fetch(
    new Request(`http://localhost/api/captures/${targetId}`),
    env
  );
  assert(
    'GET /api/captures/:id',
    `GET /api/captures/:id (${targetId}) returns status 200`,
    resByIdDb.status === 200,
    '200',
    String(resByIdDb.status)
  );
  const jsonByIdDb = (await resByIdDb.json()) as { capture: Capture };
  assert(
    'GET /api/captures/:id',
    'Lookup by ID returns the identical capture as lookup by slug',
    jsonByIdDb.capture.id === jsonBySlugDb.capture.id &&
      jsonByIdDb.capture.slug === jsonBySlugDb.capture.slug &&
      jsonByIdDb.capture.title === jsonBySlugDb.capture.title,
    'Identical capture object',
    `ID: ${jsonByIdDb.capture.id}, slug: ${jsonByIdDb.capture.slug}`
  );

  // 4.3 Verify complete schema properties on retrieved capture
  const c = jsonByIdDb.capture;
  const requiredFields = [
    'id',
    'slug',
    'title',
    'collection_slug',
    'r2_key',
    'image_url',
    'width',
    'height',
    'aspect_ratio',
    'camera_model',
    'lens_model',
    'tags',
    'featured',
    'created_at',
  ];
  const missingFields = requiredFields.filter((f) => (c as any)[f] === undefined);
  assert(
    'GET /api/captures/:id',
    'Capture object contains all required PROJECT.md schema properties',
    missingFields.length === 0,
    'Zero missing fields',
    missingFields.length === 0 ? 'All present' : `Missing: ${missingFields.join(', ')}`
  );

  // 4.4 Lookup without DB (fallback mode testing)
  const envNoDb = createMockWorkerEnv({ DB: undefined });
  const resFallbackSlug = await worker.fetch(
    new Request(`http://localhost/api/captures/${targetSlug}`),
    envNoDb
  );
  assert(
    'GET /api/captures/:id Fallback',
    'Lookup by slug succeeds in DB fallback mode',
    resFallbackSlug.status === 200,
    '200',
    String(resFallbackSlug.status)
  );

  const resFallbackId = await worker.fetch(
    new Request(`http://localhost/api/captures/${targetId}`),
    envNoDb
  );
  assert(
    'GET /api/captures/:id Fallback',
    'Lookup by ID succeeds in DB fallback mode',
    resFallbackId.status === 200,
    '200',
    String(resFallbackId.status)
  );

  // 4.5 Non-existent ID -> 404
  const resMissingId = await worker.fetch(
    new Request('http://localhost/api/captures/cap-nonexistent-99999'),
    env
  );
  assert(
    'GET /api/captures/:id',
    'GET /api/captures/nonexistent-id returns status 404',
    resMissingId.status === 404,
    '404',
    String(resMissingId.status)
  );
  const missingIdJson = (await resMissingId.json()) as { error: string };
  assert(
    'GET /api/captures/:id',
    'GET /api/captures/nonexistent-id returns JSON error',
    missingIdJson.error === 'Capture not found',
    'Capture not found',
    missingIdJson.error
  );

  // 4.6 Non-existent slug -> 404
  const resMissingSlug = await worker.fetch(
    new Request('http://localhost/api/captures/nonexistent-slug-xyz'),
    env
  );
  assert(
    'GET /api/captures/:id',
    'GET /api/captures/nonexistent-slug returns status 404',
    resMissingSlug.status === 404,
    '404',
    String(resMissingSlug.status)
  );

  // ==========================================================================
  // 5. DELETE /api/admin/captures/:id Response & Mutation Semantics
  // ==========================================================================
  console.log('--- Suite 5: DELETE /api/admin/captures/:id Response & Mutation Semantics ---');

  // 5.1 First create a dedicated test capture to delete
  const newCapturePayload = {
    title: 'Ephemeral Deletion Test Capture',
    collection_slug: 'street',
    camera_model: 'Fujifilm X-T5',
    width: 3840,
    height: 2560,
    featured: false,
  };

  const createRes = await worker.fetch(
    new Request('http://localhost/api/admin/captures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCapturePayload),
    }),
    env
  );
  assert(
    'Admin Mutations',
    'POST /api/admin/captures successfully creates test capture for deletion',
    createRes.status === 201,
    '201',
    String(createRes.status)
  );
  const createdJson = (await createRes.json()) as { capture: Capture };
  const ephemeralId = createdJson.capture.id;
  const ephemeralSlug = createdJson.capture.slug;
  const ephemeralR2Key = createdJson.capture.r2_key;
  assert(
    'Admin Mutations',
    'Ephemeral R2 key is generated correctly',
    Boolean(ephemeralR2Key && ephemeralR2Key.startsWith('captures/')),
    'captures/...',
    ephemeralR2Key
  );

  // Verify created capture is retrievable
  const checkCreated = await worker.fetch(
    new Request(`http://localhost/api/captures/${ephemeralId}`),
    env
  );
  assert(
    'Admin Mutations',
    'Ephemeral capture is retrievable prior to deletion',
    checkCreated.status === 200,
    '200',
    String(checkCreated.status)
  );

  // 5.2 Delete capture by ID
  const deleteRes = await worker.fetch(
    new Request(`http://localhost/api/admin/captures/${ephemeralId}`, {
      method: 'DELETE',
    }),
    env
  );
  assert(
    'DELETE /api/admin/captures/:id',
    'DELETE /api/admin/captures/:id returns status 200 OK',
    deleteRes.status === 200,
    '200',
    String(deleteRes.status)
  );

  const deleteJson = (await deleteRes.json()) as {
    success: boolean;
    deleted?: boolean;
    id: string;
  };

  // Explicit check for PROJECT.md:147 contract: { success: true, id: string }
  assert(
    'DELETE /api/admin/captures/:id',
    'DELETE response contains success: true',
    deleteJson.success === true,
    'true',
    String(deleteJson.success)
  );

  assert(
    'DELETE /api/admin/captures/:id',
    'DELETE response contains deleted capture id matching target',
    deleteJson.id === ephemeralId,
    ephemeralId,
    deleteJson.id
  );

  // 5.3 Verify capture is no longer accessible via GET /api/captures/:id
  const checkDeletedById = await worker.fetch(
    new Request(`http://localhost/api/captures/${ephemeralId}`),
    env
  );
  assert(
    'DELETE /api/admin/captures/:id',
    'Deleted capture is no longer found by ID (returns 404)',
    checkDeletedById.status === 404,
    '404',
    String(checkDeletedById.status)
  );

  // 5.4 Verify capture is no longer accessible via GET /api/captures/:slug
  const checkDeletedBySlug = await worker.fetch(
    new Request(`http://localhost/api/captures/${ephemeralSlug}`),
    env
  );
  assert(
    'DELETE /api/admin/captures/:id',
    'Deleted capture is no longer found by slug (returns 404)',
    checkDeletedBySlug.status === 404,
    '404',
    String(checkDeletedBySlug.status)
  );

  // 5.5 Deleting non-existent ID -> 404
  const deleteMissingRes = await worker.fetch(
    new Request('http://localhost/api/admin/captures/cap-nonexistent-already-gone', {
      method: 'DELETE',
    }),
    env
  );
  assert(
    'DELETE /api/admin/captures/:id',
    'Deleting non-existent capture returns 404 Not Found',
    deleteMissingRes.status === 404,
    '404',
    String(deleteMissingRes.status)
  );

  // 5.6 Create another test capture and delete by slug
  const createForSlugDelete = await worker.fetch(
    new Request('http://localhost/api/admin/captures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Slug Deletion Test Capture',
        collection_slug: 'minimalism',
        width: 1920,
        height: 1080,
      }),
    }),
    env
  );
  const slugDeleteTarget = (await createForSlugDelete.json()) as { capture: Capture };

  const deleteBySlugRes = await worker.fetch(
    new Request(`http://localhost/api/admin/captures/${slugDeleteTarget.capture.slug}`, {
      method: 'DELETE',
    }),
    env
  );
  assert(
    'DELETE /api/admin/captures/:id',
    'DELETE by slug returns status 200 OK',
    deleteBySlugRes.status === 200,
    '200',
    String(deleteBySlugRes.status)
  );

  const deleteBySlugJson = (await deleteBySlugRes.json()) as { success: boolean; id: string };
  assert(
    'DELETE /api/admin/captures/:id',
    'DELETE by slug returns { success: true, id } matching target ID',
    deleteBySlugJson.success === true && deleteBySlugJson.id === slugDeleteTarget.capture.id,
    `success: true, id: ${slugDeleteTarget.capture.id}`,
    `success: ${deleteBySlugJson.success}, id: ${deleteBySlugJson.id}`
  );

  // 5.7 Verify unauthorized DELETE in production returns 401
  const prodEnv = createMockWorkerEnv({
    ENVIRONMENT: 'production',
    CF_ACCESS_TEAM_DOMAIN: 'prod-auth.cloudflareaccess.com',
    CF_ACCESS_AUD: 'aud-token',
  });
  const unauthDeleteRes = await worker.fetch(
    new Request(`https://gallery.example.com/api/admin/captures/cap-arch-01`, {
      method: 'DELETE',
    }),
    prodEnv
  );
  assert(
    'DELETE /api/admin/captures/:id Auth',
    'DELETE in production without JWT returns 401 Unauthorized',
    unauthDeleteRes.status === 401,
    '401',
    String(unauthDeleteRes.status)
  );

  // ==========================================================================
  // Summary & Report
  // ==========================================================================
  console.log('\n===============================================================');
  console.log('CHALLENGER 1 EMPIRICAL RESULTS SUMMARY');
  console.log('===============================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  for (const r of results) {
    if (r.passed) {
      passedCount++;
      console.log(`  ✓ [${r.category}] ${r.test}`);
    } else {
      failedCount++;
      console.error(
        `  ✗ [${r.category}] ${r.test}\n      Expected: ${r.expected}\n      Actual:   ${r.actual}\n      Details:  ${r.details || 'N/A'}`
      );
    }
  }

  console.log('\n---------------------------------------------------------------');
  console.log(`Total Assertions: ${results.length}`);
  console.log(`Passed:           ${passedCount}`);
  console.log(`Failed:           ${failedCount}`);
  console.log('---------------------------------------------------------------\n');

  if (failedCount > 0) {
    console.error(`VERDICT: REQUEST_CHANGES (${failedCount} assertions failed)`);
    process.exit(1);
  } else {
    console.log('VERDICT: APPROVE (100% assertions passed cleanly)');
    process.exit(0);
  }
}

runEmpiricalChallenge().catch((err) => {
  console.error('Fatal execution error in empirical challenge:', err);
  process.exit(1);
});
