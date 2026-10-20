/**
 * worker/workerTypes.ts
 *
 * Re-exports gallery types and provides in-memory mock D1Database and R2Bucket
 * bindings for offline local development and deterministic integration tests.
 */

export {
  rowToCapture,
  captureToRow,
  type AuthSession,
  type BatchSyncItem,
  type BatchSyncPayload,
  type Capture,
  type CaptureRow,
  type Collection,
  type CollectionRow,
  type CreateCaptureInput,
  type ExifMetadata,
  type SortOption,
  type SyncResult,
  type UpdateCaptureInput,
} from '../src/types/gallery';

import {
  captureToRow,
  type CaptureRow,
  type CollectionRow,
} from '../src/types/gallery';
import { SEED_CAPTURES, SEED_COLLECTIONS } from '../src/data/seedCaptures';
import type { WorkerEnv } from './index';

export function slugifyTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Creates an in-memory mock D1Database and R2Bucket pre-seeded with editorial
 * collections and captures for deterministic testing and local emulation.
 */
export function createMockWorkerEnv(
  overrides: Partial<WorkerEnv> = {}
): WorkerEnv & {
  _capturesStore: Map<string, CaptureRow>;
  _collectionsStore: Map<string, CollectionRow>;
  _r2Store: Map<string, { body: Uint8Array; contentType: string; etag: string }>;
} {
  const capturesStore = new Map<string, CaptureRow>();
  const collectionsStore = new Map<string, CollectionRow>();
  const r2Store = new Map<
    string,
    { body: Uint8Array; contentType: string; etag: string }
  >();

  for (const col of SEED_COLLECTIONS) {
    collectionsStore.set(col.id, { ...col });
  }

  for (const cap of SEED_CAPTURES) {
    const row = captureToRow(cap) as CaptureRow;
    capturesStore.set(cap.id, row);
    r2Store.set(cap.r2_key, {
      body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      contentType: 'image/jpeg',
      etag: `etag-${cap.id}`,
    });
  }

  const mockDb = {
    prepare(query: string) {
      let boundValues: unknown[] = [];
      const normalized = query.replace(/\s+/g, ' ').trim().toUpperCase();

      const statement = {
        bind(...values: unknown[]) {
          boundValues = values;
          return statement;
        },
        async all<T = unknown>(): Promise<{ results: T[]; success: boolean }> {
          if (normalized.includes('FROM COLLECTIONS')) {
            const list = Array.from(collectionsStore.values()).sort(
              (a, b) => a.sort_order - b.sort_order
            );
            return { results: list as unknown as T[], success: true };
          }
          if (normalized.includes('FROM CAPTURES')) {
            const list = Array.from(capturesStore.values());
            return { results: list as unknown as T[], success: true };
          }
          return { results: [], success: true };
        },
        async first<T = unknown>(): Promise<T | null> {
          const allRes = await statement.all<T>();
          return allRes.results[0] ?? null;
        },
        async run(): Promise<{ success: boolean }> {
          if (normalized.startsWith('INSERT INTO CAPTURES')) {
            const [
              id,
              slug,
              title,
              story,
              collection_slug,
              r2_key,
              image_url,
              width,
              height,
              aspect_ratio,
              location,
              captured_at,
              camera_model,
              lens_model,
              focal_length,
              aperture,
              shutter_speed,
              iso,
              tags_json,
              featured,
              created_at,
            ] = boundValues;
            const row: CaptureRow = {
              id: String(id),
              slug: String(slug),
              title: String(title),
              story: story === null || story === undefined ? null : String(story),
              collection_slug: String(collection_slug),
              r2_key: String(r2_key),
              image_url: String(image_url),
              width: Number(width),
              height: Number(height),
              aspect_ratio: Number(aspect_ratio),
              location:
                location === null || location === undefined
                  ? null
                  : String(location),
              captured_at:
                captured_at === null || captured_at === undefined
                  ? null
                  : String(captured_at),
              camera_model:
                camera_model === null || camera_model === undefined
                  ? null
                  : String(camera_model),
              lens_model:
                lens_model === null || lens_model === undefined
                  ? null
                  : String(lens_model),
              focal_length:
                focal_length === null || focal_length === undefined
                  ? null
                  : String(focal_length),
              aperture:
                aperture === null || aperture === undefined
                  ? null
                  : String(aperture),
              shutter_speed:
                shutter_speed === null || shutter_speed === undefined
                  ? null
                  : String(shutter_speed),
              iso: iso === null || iso === undefined ? null : Number(iso),
              tags_json: String(tags_json || '[]'),
              featured: Number(featured) ? 1 : 0,
              created_at: String(created_at),
            };
            capturesStore.set(row.id, row);
            return { success: true };
          }

          if (normalized.startsWith('UPDATE CAPTURES SET')) {
            const [
              slug,
              title,
              story,
              collection_slug,
              r2_key,
              image_url,
              width,
              height,
              aspect_ratio,
              location,
              captured_at,
              camera_model,
              lens_model,
              focal_length,
              aperture,
              shutter_speed,
              iso,
              tags_json,
              featured,
              id,
            ] = boundValues;
            const targetId = String(id);
            const existing = capturesStore.get(targetId);
            if (existing) {
              capturesStore.set(targetId, {
                ...existing,
                slug: String(slug),
                title: String(title),
                story:
                  story === null || story === undefined ? null : String(story),
                collection_slug: String(collection_slug),
                r2_key: String(r2_key),
                image_url: String(image_url),
                width: Number(width),
                height: Number(height),
                aspect_ratio: Number(aspect_ratio),
                location:
                  location === null || location === undefined
                    ? null
                    : String(location),
                captured_at:
                  captured_at === null || captured_at === undefined
                    ? null
                    : String(captured_at),
                camera_model:
                  camera_model === null || camera_model === undefined
                    ? null
                    : String(camera_model),
                lens_model:
                  lens_model === null || lens_model === undefined
                    ? null
                    : String(lens_model),
                focal_length:
                  focal_length === null || focal_length === undefined
                    ? null
                    : String(focal_length),
                aperture:
                  aperture === null || aperture === undefined
                    ? null
                    : String(aperture),
                shutter_speed:
                  shutter_speed === null || shutter_speed === undefined
                    ? null
                    : String(shutter_speed),
                iso: iso === null || iso === undefined ? null : Number(iso),
                tags_json: String(tags_json || '[]'),
                featured: Number(featured) ? 1 : 0,
              });
            }
            return { success: true };
          }

          if (normalized.startsWith('DELETE FROM CAPTURES WHERE ID =')) {
            const targetId = String(boundValues[0]);
            capturesStore.delete(targetId);
            return { success: true };
          }

          return { success: true };
        },
      };

      return statement;
    },
  } as unknown as D1Database;

  const mockBucket = {
    async get(key: string) {
      const entry = r2Store.get(key);
      if (!entry) return null;
      return {
        key,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(entry.body);
            controller.close();
          },
        }),
        etag: entry.etag,
        httpEtag: `"${entry.etag}"`,
        httpMetadata: {
          contentType: entry.contentType,
        },
      };
    },
    async put(
      key: string,
      value: ArrayBuffer | Uint8Array | string,
      options?: { httpMetadata?: { contentType?: string } }
    ) {
      let bytes: Uint8Array;
      if (value instanceof Uint8Array) {
        bytes = value;
      } else if (value instanceof ArrayBuffer) {
        bytes = new Uint8Array(value);
      } else {
        bytes = new TextEncoder().encode(String(value));
      }
      const contentType = options?.httpMetadata?.contentType || 'image/jpeg';
      r2Store.set(key, {
        body: bytes,
        contentType,
        etag: `etag-${Date.now()}`,
      });
    },
    async delete(key: string) {
      r2Store.delete(key);
    },
  } as unknown as R2Bucket;

  return {
    ENVIRONMENT: 'development',
    CF_ACCESS_TEAM_DOMAIN: 'gallery-auth.cloudflareaccess.com',
    CF_ACCESS_AUD:
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    DB: mockDb,
    BUCKET: mockBucket,
    _capturesStore: capturesStore,
    _collectionsStore: collectionsStore,
    _r2Store: r2Store,
    ...overrides,
  };
}
