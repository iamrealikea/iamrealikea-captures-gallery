/**
 * worker/index.ts
 *
 * Cloudflare Edge Worker HTTP API handling capture querying, collection aggregation,
 * R2 media streaming with immutable cache headers, Zero Trust admin mutations,
 * and batch CLI synchronization.
 */

import {
  slugifyTitle,
  type BatchSyncPayload,
  type Capture,
  type CreateCaptureInput,
  type SortOption,
  type SyncResult,
  type UpdateCaptureInput,
} from './workerTypes';
import { verifyCloudflareAccess, type AuthEnv } from './auth';
import {
  deleteCaptureFromDb,
  getCaptureByIdFromDb,
  insertCaptureIntoDb,
  loadAllCaptures,
  loadAllCollections,
  updateCaptureInDb,
} from './db';
import {
  enrichCollectionsWithCounts,
  filterAndSortCaptures,
} from '../src/utils/galleryFilter';

export interface WorkerEnv extends AuthEnv {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  ASSETS?: Fetcher;
  customFetch?: typeof fetch;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

const corsHeaders: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Cf-Access-Jwt-Assertion, Authorization',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Cf-Access-Jwt-Assertion, Authorization'
  );
  return new Response(JSON.stringify(data), { status, headers });
}

function inferContentType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.avif')) return 'image/avif';
  return 'image/jpeg';
}

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    _ctx?: ExecutionContext
  ): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // ------------------------------------------------------------------------
    // 1. GET /api/auth/session
    // ------------------------------------------------------------------------
    if (request.method === 'GET' && pathname === '/api/auth/session') {
      const session = await verifyCloudflareAccess(request, env, env.customFetch);
      return jsonResponse({
        authenticated: session.authenticated,
        email: session.email,
        mode: session.mode,
      });
    }

    // ------------------------------------------------------------------------
    // 2. GET /api/collections
    // ------------------------------------------------------------------------
    if (request.method === 'GET' && pathname === '/api/collections') {
      const [collections, captures] = await Promise.all([
        loadAllCollections(env),
        loadAllCaptures(env),
      ]);
      const enriched = enrichCollectionsWithCounts(collections, captures);
      return jsonResponse({ collections: enriched });
    }

    // ------------------------------------------------------------------------
    // 3. GET /api/captures
    // ------------------------------------------------------------------------
    if (request.method === 'GET' && pathname === '/api/captures') {
      const captures = await loadAllCaptures(env);
      const collection = url.searchParams.get('collection');
      const search = url.searchParams.get('search') || '';
      const camera = url.searchParams.get('camera');
      const sort = (url.searchParams.get('sort') as SortOption) || 'featured';

      const filtered = filterAndSortCaptures(captures, {
        collection,
        search,
        camera,
        sort,
      });

      return jsonResponse({
        captures: filtered,
        total: filtered.length,
      });
    }

    // ------------------------------------------------------------------------
    // 4. GET /api/captures/:id
    // ------------------------------------------------------------------------
    if (request.method === 'GET' && pathname.startsWith('/api/captures/')) {
      const idOrSlug = decodeURIComponent(pathname.slice('/api/captures/'.length));
      const found = env.DB
        ? await getCaptureByIdFromDb(env.DB, idOrSlug)
        : (await loadAllCaptures(env)).find(
            (c) => c.id === idOrSlug || c.slug === idOrSlug
          );
      if (!found) {
        return jsonResponse({ error: 'Capture not found' }, 404);
      }
      return jsonResponse({ capture: found });
    }

    // ------------------------------------------------------------------------
    // 5. GET /api/media/:key (Streams binary from R2 with immutable cache headers)
    // ------------------------------------------------------------------------
    if (request.method === 'GET' && pathname.startsWith('/api/media/')) {
      const key = decodeURIComponent(pathname.slice('/api/media/'.length));
      if (!key) {
        return jsonResponse({ error: 'Missing media key' }, 400);
      }

      if (env.BUCKET) {
        const object = await env.BUCKET.get(key);
        if (object) {
          const headers = new Headers();
          const contentType =
            object.httpMetadata?.contentType || inferContentType(key);
          headers.set('Content-Type', contentType);
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          const etag = object.httpEtag || `"${object.etag || 'r2-asset'}"`;
          headers.set('ETag', etag);

          // Handle conditional GET: If-None-Match
          const ifNoneMatch =
            request.headers.get('If-None-Match') ||
            request.headers.get('if-none-match');
          if (ifNoneMatch) {
            const clientEtag = ifNoneMatch.trim();
            const rawEtag = object.etag || '';
            const quotedEtag = `"${rawEtag}"`;
            const httpEtag = object.httpEtag || '';

            if (
              clientEtag === '*' ||
              clientEtag === etag ||
              clientEtag === rawEtag ||
              clientEtag === quotedEtag ||
              clientEtag === httpEtag ||
              clientEtag === `W/${etag}` ||
              clientEtag === `W/${quotedEtag}`
            ) {
              return new Response(null, { status: 304, headers });
            }
          }

          return new Response(object.body, { status: 200, headers });
        }
      }

      return jsonResponse({ error: 'Media object not found', key }, 404);
    }

    // ------------------------------------------------------------------------
    // 6. Zero Trust Protected Admin Routes (/api/admin/*)
    // ------------------------------------------------------------------------
    if (pathname.startsWith('/api/admin/')) {
      const auth = await verifyCloudflareAccess(request, env, env.customFetch);
      if (!auth.authenticated) {
        return jsonResponse(
          {
            error: auth.error || 'Unauthorized: Cloudflare Access JWT required',
            authenticated: false,
          },
          401
        );
      }

      // ----------------------------------------------------------------------
      // 6a. POST /api/admin/captures
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && pathname === '/api/admin/captures') {
        const contentType = request.headers.get('Content-Type') || '';
        let input: CreateCaptureInput;
        let uploadedBytes: ArrayBuffer | null = null;
        let uploadedMimeType = 'image/jpeg';

        if (contentType.includes('multipart/form-data')) {
          const formData = await request.formData();
          const fileEntry = formData.get('file');
          if (fileEntry && typeof fileEntry !== 'string') {
            const file = fileEntry as File;
            if (!ALLOWED_MIME_TYPES.has(file.type)) {
              return jsonResponse(
                {
                  error: `Unsupported image MIME type: ${file.type}. Allowed: JPEG, PNG, WebP, AVIF.`,
                },
                400
              );
            }
            if (file.size > MAX_UPLOAD_BYTES) {
              return jsonResponse(
                { error: 'File exceeds maximum upload limit of 25MB.' },
                400
              );
            }
            uploadedBytes = await file.arrayBuffer();
            uploadedMimeType = file.type;
          }

          const rawTags = formData.get('tags');
          let parsedTags: string[] = [];
          if (typeof rawTags === 'string' && rawTags.trim()) {
            try {
              parsedTags = JSON.parse(rawTags);
            } catch {
              parsedTags = rawTags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);
            }
          }

          const width = Number(formData.get('width')) || 3840;
          const height = Number(formData.get('height')) || 2560;

          input = {
            title: String(formData.get('title') || '').trim(),
            slug: formData.get('slug')
              ? String(formData.get('slug')).trim()
              : undefined,
            story: formData.get('story') ? String(formData.get('story')) : null,
            collection_slug: String(
              formData.get('collection_slug') || 'architecture'
            ).trim(),
            location: formData.get('location')
              ? String(formData.get('location'))
              : null,
            captured_at: formData.get('captured_at')
              ? String(formData.get('captured_at'))
              : null,
            camera_model: formData.get('camera_model')
              ? String(formData.get('camera_model'))
              : null,
            lens_model: formData.get('lens_model')
              ? String(formData.get('lens_model'))
              : null,
            focal_length: formData.get('focal_length')
              ? String(formData.get('focal_length'))
              : null,
            aperture: formData.get('aperture')
              ? String(formData.get('aperture'))
              : null,
            shutter_speed: formData.get('shutter_speed')
              ? String(formData.get('shutter_speed'))
              : null,
            iso: formData.get('iso') ? Number(formData.get('iso')) : null,
            width,
            height,
            tags: parsedTags,
            featured:
              formData.get('featured') === 'true' ||
              formData.get('featured') === '1',
          };
        } else {
          try {
            input = (await request.json()) as CreateCaptureInput;
          } catch {
            return jsonResponse({ error: 'Invalid JSON request body' }, 400);
          }
          if (
            typeof input.mime_type === 'string' &&
            !ALLOWED_MIME_TYPES.has(input.mime_type)
          ) {
            return jsonResponse(
              {
                error: `Unsupported image MIME type: ${input.mime_type}. Allowed: JPEG, PNG, WebP, AVIF.`,
              },
              400
            );
          }
          if (
            typeof input.file_size === 'number' &&
            input.file_size > MAX_UPLOAD_BYTES
          ) {
            return jsonResponse(
              { error: 'File exceeds maximum upload limit of 25MB.' },
              400
            );
          }
        }

        if (!input.title || !input.title.trim()) {
          return jsonResponse({ error: 'Capture title is required' }, 400);
        }
        if (!input.collection_slug || !input.collection_slug.trim()) {
          return jsonResponse({ error: 'Collection slug is required' }, 400);
        }

        const slug =
          input.slug && input.slug.trim()
            ? slugifyTitle(input.slug)
            : slugifyTitle(input.title);
        const id = `cap-${crypto.randomUUID()}`;
        const width = Number(input.width) > 0 ? Number(input.width) : 3840;
        const height = Number(input.height) > 0 ? Number(input.height) : 2560;
        const aspectRatio =
          input.aspect_ratio && input.aspect_ratio > 0
            ? input.aspect_ratio
            : Number((width / height).toFixed(2));

        const r2Key =
          input.r2_key || `captures/${input.collection_slug}/${slug}.jpg`;
        const imageUrl = input.image_url || `/api/media/${r2Key}`;

        if (env.BUCKET && uploadedBytes) {
          await env.BUCKET.put(r2Key, uploadedBytes, {
            httpMetadata: { contentType: uploadedMimeType },
          });
        }

        const newCapture: Capture = {
          id,
          slug,
          title: input.title.trim(),
          story: input.story ?? null,
          collection_slug: input.collection_slug.trim(),
          r2_key: r2Key,
          image_url: imageUrl,
          width,
          height,
          aspect_ratio: aspectRatio,
          location: input.location ?? null,
          captured_at: input.captured_at ?? new Date().toISOString(),
          camera_model: input.camera_model ?? null,
          lens_model: input.lens_model ?? null,
          focal_length: input.focal_length ?? null,
          aperture: input.aperture ?? null,
          shutter_speed: input.shutter_speed ?? null,
          iso: input.iso ?? null,
          tags: Array.isArray(input.tags) ? input.tags : [],
          featured: Boolean(input.featured),
          created_at: new Date().toISOString(),
        };

        if (env.DB) {
          await insertCaptureIntoDb(env.DB, newCapture);
        }

        return jsonResponse({ capture: newCapture }, 201);
      }

      // ----------------------------------------------------------------------
      // 6b. PUT /api/admin/captures/:id
      // ----------------------------------------------------------------------
      if (
        request.method === 'PUT' &&
        pathname.startsWith('/api/admin/captures/')
      ) {
        const targetId = decodeURIComponent(
          pathname.slice('/api/admin/captures/'.length)
        );
        let updates: UpdateCaptureInput;
        try {
          updates = (await request.json()) as UpdateCaptureInput;
        } catch {
          return jsonResponse({ error: 'Invalid JSON request body' }, 400);
        }

        const captures = await loadAllCaptures(env);
        const existing = captures.find(
          (c) => c.id === targetId || c.slug === targetId
        );
        if (!existing) {
          return jsonResponse({ error: 'Capture not found' }, 404);
        }

        const width =
          updates.width !== undefined && updates.width > 0
            ? updates.width
            : existing.width;
        const height =
          updates.height !== undefined && updates.height > 0
            ? updates.height
            : existing.height;

        const updatedCapture: Capture = {
          ...existing,
          title:
            updates.title !== undefined ? updates.title.trim() : existing.title,
          slug:
            updates.slug !== undefined ? updates.slug.trim() : existing.slug,
          story: updates.story !== undefined ? updates.story : existing.story,
          collection_slug:
            updates.collection_slug !== undefined
              ? updates.collection_slug.trim()
              : existing.collection_slug,
          location:
            updates.location !== undefined
              ? updates.location
              : existing.location,
          captured_at:
            updates.captured_at !== undefined
              ? updates.captured_at
              : existing.captured_at,
          camera_model:
            updates.camera_model !== undefined
              ? updates.camera_model
              : existing.camera_model,
          lens_model:
            updates.lens_model !== undefined
              ? updates.lens_model
              : existing.lens_model,
          focal_length:
            updates.focal_length !== undefined
              ? updates.focal_length
              : existing.focal_length,
          aperture:
            updates.aperture !== undefined
              ? updates.aperture
              : existing.aperture,
          shutter_speed:
            updates.shutter_speed !== undefined
              ? updates.shutter_speed
              : existing.shutter_speed,
          iso: updates.iso !== undefined ? updates.iso : existing.iso,
          width,
          height,
          aspect_ratio:
            updates.aspect_ratio !== undefined
              ? updates.aspect_ratio
              : Number((width / height).toFixed(2)),
          tags:
            updates.tags !== undefined && Array.isArray(updates.tags)
              ? updates.tags
              : existing.tags,
          featured:
            updates.featured !== undefined
              ? Boolean(updates.featured)
              : existing.featured,
        };

        if (env.DB) {
          await updateCaptureInDb(env.DB, updatedCapture);
        }

        return jsonResponse({ capture: updatedCapture }, 200);
      }

      // ----------------------------------------------------------------------
      // 6c. DELETE /api/admin/captures/:id
      // ----------------------------------------------------------------------
      if (
        request.method === 'DELETE' &&
        pathname.startsWith('/api/admin/captures/')
      ) {
        const targetId = decodeURIComponent(
          pathname.slice('/api/admin/captures/'.length)
        );
        const captures = await loadAllCaptures(env);
        const existing = captures.find(
          (c) => c.id === targetId || c.slug === targetId
        );
        if (!existing) {
          return jsonResponse({ error: 'Capture not found' }, 404);
        }

        if (env.DB) {
          await deleteCaptureFromDb(env.DB, existing.id);
        }
        if (env.BUCKET && existing.r2_key) {
          await env.BUCKET.delete(existing.r2_key);
        }

        return jsonResponse(
          { success: true, deleted: true, id: existing.id },
          200
        );
      }

      // ----------------------------------------------------------------------
      // 6d. POST /api/admin/sync (Batch folder sync ingestion)
      // ----------------------------------------------------------------------
      if (request.method === 'POST' && pathname === '/api/admin/sync') {
        let payload: BatchSyncPayload;
        try {
          payload = (await request.json()) as BatchSyncPayload;
        } catch {
          return jsonResponse({ error: 'Invalid sync JSON payload' }, 400);
        }

        const items = Array.isArray(payload?.captures) ? payload.captures : [];
        const existingCaptures = await loadAllCaptures(env);
        let inserted = 0;
        let updated = 0;

        for (const item of items) {
          const existing = existingCaptures.find(
            (c) => c.slug === item.slug || c.r2_key === item.r2_key
          );
          const width = item.exif?.width || existing?.width || 3840;
          const height = item.exif?.height || existing?.height || 2560;
          const aspectRatio = Number((width / height).toFixed(2));

          if (existing) {
            const merged: Capture = {
              ...existing,
              title: item.title || existing.title,
              collection_slug: item.collection_slug || existing.collection_slug,
              r2_key: item.r2_key || existing.r2_key,
              width,
              height,
              aspect_ratio: aspectRatio,
              camera_model: item.exif?.camera_model ?? existing.camera_model,
              lens_model: item.exif?.lens_model ?? existing.lens_model,
              focal_length: item.exif?.focal_length ?? existing.focal_length,
              aperture: item.exif?.aperture ?? existing.aperture,
              shutter_speed: item.exif?.shutter_speed ?? existing.shutter_speed,
              iso: item.exif?.iso ?? existing.iso,
              captured_at: item.exif?.captured_at ?? existing.captured_at,
            };
            if (env.DB) {
              await updateCaptureInDb(env.DB, merged);
            }
            updated++;
          } else {
            const created: Capture = {
              id: `cap-${crypto.randomUUID()}`,
              slug: item.slug,
              title: item.title,
              story: null,
              collection_slug: item.collection_slug,
              r2_key: item.r2_key,
              image_url: `/api/media/${item.r2_key}`,
              width,
              height,
              aspect_ratio: aspectRatio,
              location: null,
              captured_at: item.exif?.captured_at ?? new Date().toISOString(),
              camera_model: item.exif?.camera_model ?? null,
              lens_model: item.exif?.lens_model ?? null,
              focal_length: item.exif?.focal_length ?? null,
              aperture: item.exif?.aperture ?? null,
              shutter_speed: item.exif?.shutter_speed ?? null,
              iso: item.exif?.iso ?? null,
              tags: [item.collection_slug],
              featured: false,
              created_at: new Date().toISOString(),
            };
            if (env.DB) {
              await insertCaptureIntoDb(env.DB, created);
            }
            existingCaptures.push(created);
            inserted++;
          }
        }

        const syncResult: SyncResult = {
          synced: inserted + updated,
          inserted,
          updated,
        };
        return jsonResponse(syncResult, 200);
      }
    }

    // ------------------------------------------------------------------------
    // 7. Static Assets Fallback (SPA index.html)
    // ------------------------------------------------------------------------
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return jsonResponse({ error: `Route not found: ${pathname}` }, 404);
  },
};
