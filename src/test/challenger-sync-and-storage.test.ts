/**
 * src/test/challenger-sync-and-storage.test.ts
 *
 * Empirical Challenger 2 Test Suite for Milestone 2:
 * - Local Folder Sync CLI (`scripts/sync-captures.ts`) & Dry-Run verification
 * - Corrupted, empty, truncated, and adversarial image file stress-testing
 * - Cloudflare D1 query execution helpers (`worker/db.ts`) & relational contract
 * - In-Memory Mock Store (`src/data/mockStore.ts`) CRUD, filtering & telemetry preservation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runCliSync, scanLocalCaptures } from '../../scripts/sync-captures';
import {
  parseBinaryDimensions,
  normalizeExifDate,
  slugify,
  titleFromFilename,
} from '../utils/exifExtractor';
import {
  getCapturesFromDb,
  getCaptureByIdFromDb,
  getCollectionsFromDb,
  insertCaptureIntoDb,
  updateCaptureInDb,
  deleteCaptureFromDb,
  loadAllCaptures,
  loadAllCollections,
} from '../../worker/db';
import { createMockWorkerEnv } from '../../worker/workerTypes';
import { MockStore, defaultMockStore } from '../data/mockStore';
import { SEED_CAPTURES } from '../data/seedCaptures';
import type { Capture } from '../types/gallery';

describe('Empirical Challenger 2 — CLI Sync, D1 Schema & MockStore Contracts', () => {
  let tempCapturesDir: string;

  beforeEach(() => {
    // Create an isolated temporary directory for filesystem testing
    tempCapturesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'captures-sync-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (tempCapturesDir && fs.existsSync(tempCapturesDir)) {
      fs.rmSync(tempCapturesDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // 1. Local Folder Sync CLI: Standard ./captures/ and --dry-run
  // =========================================================================
  describe('1. Local Folder Sync CLI Standard Operation & Dry-Run Contract', () => {
    it('scans the actual project ./captures directory and extracts valid metadata for all 6 photos', async () => {
      const items = await scanLocalCaptures();
      expect(items).toHaveLength(6);

      const collections = new Set(items.map((i) => i.collection_slug));
      expect(collections).toEqual(new Set(['architecture', 'minimalism', 'street']));

      for (const item of items) {
        expect(item.filePath).toBeTruthy();
        expect(fs.existsSync(item.filePath)).toBe(true);
        expect(item.collection_slug).toBeTruthy();
        expect(item.slug).toBeTruthy();
        expect(item.title).toBeTruthy();
        expect(item.r2_key).toBe(`captures/${item.collection_slug}/${path.basename(item.filePath)}`);

        // Check that EXIF telemetry was extracted via exifr
        expect(item.exif).toBeDefined();
        expect(item.exif.camera_model).toBeTruthy();
        expect(item.exif.width).toBeGreaterThan(0);
        expect(item.exif.height).toBeGreaterThan(0);
        expect(item.exif.focal_length).toMatch(/^\d+mm$/);
        expect(item.exif.aperture).toMatch(/^f\/\d+(\.\d+)?$/);
        expect(item.exif.shutter_speed).toMatch(/^1\/\d+s$/);
        expect(item.exif.iso).toBeGreaterThan(0);
      }
    });

    it('executes --dry-run without modifying worker database or R2 storage', async () => {
      const mockEnv = createMockWorkerEnv();
      const initialDbSize = mockEnv._capturesStore.size;
      const initialR2Size = mockEnv._r2Store.size;

      const report = await runCliSync({
        dryRun: true,
        silent: true,
        workerEnv: mockEnv,
      });

      expect(report.dryRun).toBe(true);
      expect(report.items).toHaveLength(6);
      expect(report.result.synced).toBe(6);
      expect(report.result.inserted).toBe(0);
      expect(report.result.updated).toBe(0);

      // Verify that neither D1 mock store nor R2 store was modified in dry-run mode
      expect(mockEnv._capturesStore.size).toBe(initialDbSize);
      expect(mockEnv._r2Store.size).toBe(initialR2Size);
    });

    it('returns empty list gracefully when directory is non-existent or empty', async () => {
      const nonExistent = path.join(tempCapturesDir, 'does-not-exist');
      const itemsNonExistent = await scanLocalCaptures(nonExistent);
      expect(itemsNonExistent).toEqual([]);

      const reportEmpty = await runCliSync({
        capturesDir: tempCapturesDir,
        dryRun: true,
        silent: true,
      });
      expect(reportEmpty.dryRun).toBe(true);
      expect(reportEmpty.items).toHaveLength(0);
      expect(reportEmpty.result.synced).toBe(0);
    });
  });

  // =========================================================================
  // 2. Corrupted, Empty, Truncated, and Adversarial Files Stress-Testing
  // =========================================================================
  describe('2. Corrupted, Empty, Truncated & Adversarial Files Handling', () => {
    it('handles zero-byte empty image files gracefully without throwing', async () => {
      const colDir = path.join(tempCapturesDir, 'empty-col');
      fs.mkdirSync(colDir, { recursive: true });
      const emptyFile = path.join(colDir, 'zero-length.jpg');
      fs.writeFileSync(emptyFile, Buffer.alloc(0));

      const items = await scanLocalCaptures(tempCapturesDir);
      expect(items).toHaveLength(1);
      const item = items[0];
      expect(item.slug).toBe('zero-length');
      expect(item.title).toBe('Zero length');
      expect(item.exif.camera_model).toBeNull();
      expect(item.exif.width).toBeNull();
      expect(item.exif.height).toBeNull();

      // Ensure runCliSync with dryRun completes cleanly
      const dryReport = await runCliSync({
        capturesDir: tempCapturesDir,
        dryRun: true,
        silent: true,
      });
      expect(dryReport.result.synced).toBe(1);
    });

    it('handles sub-24 byte truncated files without throwing or out-of-bounds error', async () => {
      const colDir = path.join(tempCapturesDir, 'truncated-col');
      fs.mkdirSync(colDir, { recursive: true });

      // Test 1-byte, 5-byte, 23-byte files
      fs.writeFileSync(path.join(colDir, 'one-byte.jpg'), Buffer.from([0xff]));
      fs.writeFileSync(path.join(colDir, 'five-bytes.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]));
      fs.writeFileSync(path.join(colDir, 'twenty-three.png'), Buffer.alloc(23, 0x55));

      const items = await scanLocalCaptures(tempCapturesDir);
      expect(items).toHaveLength(3);
      for (const item of items) {
        expect(item.exif.width).toBeNull();
        expect(item.exif.height).toBeNull();
      }
    });

    it('handles corrupted JPEG marker tables with garbage offsets without crashing or infinite looping', async () => {
      const colDir = path.join(tempCapturesDir, 'corrupted-col');
      fs.mkdirSync(colDir, { recursive: true });

      // Construct a corrupted JPEG: SOI (FF D8) followed by repeated FF bytes and invalid marker segments
      const maliciousBytes = Buffer.alloc(1024);
      maliciousBytes[0] = 0xff;
      maliciousBytes[1] = 0xd8;
      // Fill remainder with random adversarial byte patterns
      for (let i = 2; i < maliciousBytes.length; i++) {
        maliciousBytes[i] = (i * 37) % 256;
      }
      fs.writeFileSync(path.join(colDir, 'corrupted-markers.jpg'), maliciousBytes);

      const items = await scanLocalCaptures(tempCapturesDir);
      expect(items).toHaveLength(1);
      expect(items[0].exif.width).toBeNull();
      expect(items[0].exif.height).toBeNull();
    });

    it('handles non-image files with valid image extensions (plain text, JSON, HTML)', async () => {
      const colDir = path.join(tempCapturesDir, 'fake-images');
      fs.mkdirSync(colDir, { recursive: true });

      fs.writeFileSync(
        path.join(colDir, 'fake-text.jpg'),
        Buffer.from('This is plain ASCII text pretending to be an image.')
      );
      fs.writeFileSync(
        path.join(colDir, 'fake-html.webp'),
        Buffer.from('<!DOCTYPE html><html><body><h1>Malicious</h1></body></html>')
      );
      fs.writeFileSync(
        path.join(colDir, 'fake-json.png'),
        Buffer.from(JSON.stringify({ attack: 'vector', width: 99999 }))
      );

      const items = await scanLocalCaptures(tempCapturesDir);
      expect(items).toHaveLength(3);
      for (const item of items) {
        expect(item.exif.camera_model).toBeNull();
        expect(item.exif.width).toBeNull();
        expect(item.exif.height).toBeNull();
      }
    });

    it('ignores non-supported file extensions and non-directory entries in root', async () => {
      // Put unsupported files and non-collection files
      fs.writeFileSync(path.join(tempCapturesDir, 'README.md'), '# Notes');
      fs.writeFileSync(path.join(tempCapturesDir, '.DS_Store'), 'ignored');

      const validCol = path.join(tempCapturesDir, 'valid-col');
      fs.mkdirSync(validCol, { recursive: true });
      fs.writeFileSync(path.join(validCol, 'ignored.txt'), 'text');
      fs.writeFileSync(path.join(validCol, 'ignored.pdf'), 'pdf');
      fs.writeFileSync(path.join(validCol, '.gitkeep'), '');
      fs.writeFileSync(path.join(validCol, 'valid-name.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

      const items = await scanLocalCaptures(tempCapturesDir);
      expect(items).toHaveLength(1);
      expect(items[0].slug).toBe('valid-name');
    });

    it('parses valid PNG binary dimensions even without EXIF IFD headers', () => {
      // Minimal valid 16x32 PNG header:
      // 8-byte PNG signature: 89 50 4E 47 0D 0A 1A 0A
      // 4-byte chunk length: 00 00 00 0D (13 bytes)
      // 4-byte chunk type: 49 48 44 52 ('IHDR')
      // 4-byte width: 00 00 00 10 (16 px)
      // 4-byte height: 00 00 00 20 (32 px)
      const pngHeader = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x10,
        0x00, 0x00, 0x00, 0x20,
        0x08, 0x02, 0x00, 0x00, 0x00,
      ]);

      const dims = parseBinaryDimensions(pngHeader);
      expect(dims).toEqual({ width: 16, height: 32 });
    });

    it('parses valid baseline JPEG SOF0 dimensions accurately', () => {
      // Minimal valid JPEG with SOF0 (>= 24 bytes):
      // SOI: FF D8
      // SOF0 marker: FF C0, length: 00 11 (17 bytes), precision: 08, height: 04 00 (1024), width: 08 00 (2048)
      const jpegSof0 = new Uint8Array([
        0xff, 0xd8,
        0xff, 0xc0,
        0x00, 0x11,
        0x08,
        0x04, 0x00, // height = 1024
        0x08, 0x00, // width = 2048
        0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
        0xff, 0xd9, // EOI
        0x00, 0x00, // padding to exceed 24 bytes
      ]);

      const dims = parseBinaryDimensions(jpegSof0);
      expect(dims).toEqual({ width: 2048, height: 1024 });
    });

    it('normalizes various EXIF date formats and handles invalid date strings gracefully', () => {
      expect(normalizeExifDate('2026:03:15 14:30:45')).toBe('2026-03-15T14:30:45Z');
      expect(normalizeExifDate(new Date('2026-04-01T08:00:00Z'))).toBe('2026-04-01T08:00:00.000Z');
      expect(normalizeExifDate('invalid-date-string')).toBeNull();
      expect(normalizeExifDate(null)).toBeNull();
      expect(normalizeExifDate(undefined)).toBeNull();
      expect(normalizeExifDate('')).toBeNull();
    });

    it('slugify and titleFromFilename handle boundary cases cleanly', () => {
      expect(slugify('Tokyo Night Street! #01.JPG')).toBe('tokyo-night-street-01');
      expect(slugify('---test---slug---')).toBe('test-slug');
      expect(slugify('')).toBe('');

      expect(titleFromFilename('brutalist-atrium-01.jpg')).toBe('Brutalist atrium 01');
      expect(titleFromFilename('shibuya_rain_reflections.png')).toBe('Shibuya rain reflections');
      expect(titleFromFilename('.jpg')).toBe('Untitled capture');
      expect(titleFromFilename('')).toBe('Untitled capture');
    });
  });

  // =========================================================================
  // 3. worker/db.ts: D1 Query Helpers & Relational Contract
  // =========================================================================
  describe('3. worker/db.ts: D1 Query Helpers & Relational Contracts', () => {
    it('executes full CRUD lifecycle on D1 database with strict telemetry preservation', async () => {
      const env = createMockWorkerEnv();
      const db = env.DB!;

      // 1. Initial count
      const initialCaptures = await getCapturesFromDb(db);
      expect(initialCaptures.length).toBeGreaterThanOrEqual(8);

      // 2. Insert new capture with complete telemetry
      const newCapture: Capture = {
        id: 'cap-challenger-telemetry-01',
        slug: 'challenger-telemetry-test',
        title: 'Challenger Telemetry Test',
        story: 'Testing full preservation of technical optics telemetry.',
        collection_slug: 'architecture',
        r2_key: 'captures/architecture/challenger.jpg',
        image_url: '/api/media/captures/architecture/challenger.jpg',
        width: 6000,
        height: 4000,
        aspect_ratio: 1.5,
        location: 'Berlin, Germany',
        captured_at: '2026-04-10T11:00:00Z',
        camera_model: 'Leica Q2',
        lens_model: 'Summilux 28mm f/1.7 ASPH',
        focal_length: '28mm',
        aperture: 'f/1.7',
        shutter_speed: '1/500s',
        iso: 200,
        tags: ['architecture', 'leica', 'telemetry'],
        featured: true,
        created_at: '2026-04-10T12:00:00Z',
      };

      await insertCaptureIntoDb(db, newCapture);

      // 3. Read back by ID and by Slug
      const readById = await getCaptureByIdFromDb(db, 'cap-challenger-telemetry-01');
      expect(readById).not.toBeNull();
      expect(readById?.id).toBe(newCapture.id);
      expect(readById?.slug).toBe(newCapture.slug);
      expect(readById?.title).toBe(newCapture.title);
      expect(readById?.camera_model).toBe('Leica Q2');
      expect(readById?.lens_model).toBe('Summilux 28mm f/1.7 ASPH');
      expect(readById?.focal_length).toBe('28mm');
      expect(readById?.aperture).toBe('f/1.7');
      expect(readById?.shutter_speed).toBe('1/500s');
      expect(readById?.iso).toBe(200);
      expect(readById?.featured).toBe(true);
      expect(readById?.tags).toEqual(['architecture', 'leica', 'telemetry']);
      // Verify tags_json does not leak into the returned Capture object
      expect((readById as unknown as Record<string, unknown>).tags_json).toBeUndefined();

      const readBySlug = await getCaptureByIdFromDb(db, 'challenger-telemetry-test');
      expect(readBySlug).not.toBeNull();
      expect(readBySlug?.id).toBe('cap-challenger-telemetry-01');

      // 4. Update capture
      const updatedCapture: Capture = {
        ...readById!,
        title: 'Challenger Telemetry Updated',
        featured: false,
        tags: ['updated-tag'],
        iso: 400,
      };
      await updateCaptureInDb(db, updatedCapture);

      const readAfterUpdate = await getCaptureByIdFromDb(db, 'cap-challenger-telemetry-01');
      expect(readAfterUpdate?.title).toBe('Challenger Telemetry Updated');
      expect(readAfterUpdate?.featured).toBe(false);
      expect(readAfterUpdate?.tags).toEqual(['updated-tag']);
      expect(readAfterUpdate?.iso).toBe(400);

      // 5. Delete capture
      await deleteCaptureFromDb(db, 'cap-challenger-telemetry-01');
      const readAfterDelete = await getCaptureByIdFromDb(db, 'cap-challenger-telemetry-01');
      expect(readAfterDelete).toBeNull();
    });

    it('returns null when querying non-existent capture ID or slug in D1', async () => {
      const env = createMockWorkerEnv();
      const res = await getCaptureByIdFromDb(env.DB!, 'totally-nonexistent-slug-or-id');
      expect(res).toBeNull();
    });

    it('retrieves collections sorted by sort_order ascending from D1', async () => {
      const env = createMockWorkerEnv();
      const collections = await getCollectionsFromDb(env.DB!);
      expect(collections.length).toBe(3);
      for (let i = 0; i < collections.length - 1; i++) {
        expect(collections[i].sort_order).toBeLessThanOrEqual(collections[i + 1].sort_order);
      }
    });

    it('loadAllCaptures falls back to SEED_CAPTURES when DB binding is omitted or fails', async () => {
      // 1. Omitted DB
      const resultNoDb = await loadAllCaptures({});
      expect(resultNoDb.length).toBe(SEED_CAPTURES.length);
      expect(resultNoDb[0].id).toBe(SEED_CAPTURES[0].id);

      // 2. Failing DB (simulated via throwing prepare)
      const failingDb = {
        prepare: () => {
          throw new Error('D1 connection failure');
        },
      } as unknown as D1Database;

      const resultFailingDb = await loadAllCaptures({ DB: failingDb });
      expect(resultFailingDb.length).toBe(SEED_CAPTURES.length);

      // 3. Immutability check: mutating loadAllCaptures return value does not mutate SEED_CAPTURES
      resultNoDb[0].title = 'Mutated Title';
      expect(SEED_CAPTURES[0].title).not.toBe('Mutated Title');
    });

    it('loadAllCollections falls back to SEED_COLLECTIONS when DB binding is omitted or fails', async () => {
      const resultNoDb = await loadAllCollections({});
      expect(resultNoDb.length).toBe(3);

      const failingDb = {
        prepare: () => {
          throw new Error('D1 connection failure');
        },
      } as unknown as D1Database;

      const resultFailingDb = await loadAllCollections({ DB: failingDb });
      expect(resultFailingDb.length).toBe(3);
    });
  });

  // =========================================================================
  // 4. src/data/mockStore.ts: In-Memory Store CRUD, Filtering & Telemetry
  // =========================================================================
  describe('4. src/data/mockStore.ts: Store CRUD, Filtering & Resilience', () => {
    it('manages full capture lifecycle in MockStore with state cloning and isolation', () => {
      const store = new MockStore();
      const initialCount = store.getAllCaptures().length;

      // 1. Create capture
      const created = store.createCapture({
        title: 'Mock Night Vista',
        story: 'Tokyo tower skyline at twilight.',
        collection_slug: 'street',
        width: 3840,
        height: 2160,
        location: 'Tokyo, Japan',
        camera_model: 'Fujifilm X-T5',
        lens_model: 'Fujinon XF 33mm f/1.4',
        focal_length: '33mm',
        aperture: 'f/1.4',
        shutter_speed: '1/250s',
        iso: 800,
        tags: ['tokyo', 'night', 'street'],
        featured: true,
      });

      expect(created.id).toMatch(/^cap-/);
      expect(created.slug).toBe('mock-night-vista');
      expect(created.aspect_ratio).toBe(1.78);
      expect(store.getAllCaptures().length).toBe(initialCount + 1);

      // Verify cloning: modifying returned object does not alter internal store state
      created.title = 'External Alteration';
      expect(store.getCaptureByIdOrSlug(created.id)?.title).toBe('Mock Night Vista');

      // 2. Query by slug and by id
      const bySlug = store.getCaptureByIdOrSlug('mock-night-vista');
      expect(bySlug).not.toBeNull();
      expect(bySlug?.id).toBe(created.id);

      const byId = store.getCaptureByIdOrSlug(created.id);
      expect(byId).not.toBeNull();
      expect(byId?.slug).toBe('mock-night-vista');

      // 3. Update capture
      const updated = store.updateCapture(created.id, {
        title: 'Mock Night Vista Dawn',
        featured: false,
        tags: ['tokyo', 'dawn'],
        width: 1000,
        height: 1000,
      });
      expect(updated.title).toBe('Mock Night Vista Dawn');
      expect(updated.featured).toBe(false);
      expect(updated.tags).toEqual(['tokyo', 'dawn']);
      expect(updated.aspect_ratio).toBe(1);

      // Verify update error for non-existent id
      expect(() =>
        store.updateCapture('non-existent-id-12345', { title: 'Ghost' })
      ).toThrow(/not found/i);

      // 4. Delete capture
      expect(store.deleteCapture(created.id)).toBe(true);
      expect(store.getCaptureByIdOrSlug(created.id)).toBeNull();
      expect(store.deleteCapture(created.id)).toBe(false);
      expect(store.getAllCaptures().length).toBe(initialCount);

      // 5. Reset
      store.createCapture({
        title: 'Disposable',
        collection_slug: 'street',
        width: 100,
        height: 100,
      });
      expect(store.getAllCaptures().length).toBe(initialCount + 1);
      store.reset();
      expect(store.getAllCaptures().length).toBe(initialCount);
    });

    it('filters and sorts captures correctly via getFilteredCaptures', () => {
      const store = new MockStore();

      // Filter by collection
      const archCaptures = store.getFilteredCaptures({ collection: 'architecture' });
      expect(archCaptures.length).toBeGreaterThan(0);
      expect(archCaptures.every((c) => c.collection_slug === 'architecture')).toBe(true);

      // Filter by camera
      const leicaCaptures = store.getFilteredCaptures({ camera: 'Leica Q2' });
      expect(leicaCaptures.length).toBeGreaterThan(0);
      expect(leicaCaptures.every((c) => c.camera_model === 'Leica Q2')).toBe(true);

      // Filter by search query across title, location, tags
      const searchResults = store.getFilteredCaptures({ search: 'concrete' });
      expect(searchResults.length).toBeGreaterThan(0);

      // Sort by captured_desc
      const sortedByDate = store.getFilteredCaptures({ sort: 'captured_desc' });
      for (let i = 0; i < sortedByDate.length - 1; i++) {
        const d1 = new Date(sortedByDate[i].captured_at || 0).getTime();
        const d2 = new Date(sortedByDate[i + 1].captured_at || 0).getTime();
        expect(d1).toBeGreaterThanOrEqual(d2);
      }

      // Sort by featured
      const sortedByFeatured = store.getFilteredCaptures({ sort: 'featured' });
      const firstUnfeaturedIndex = sortedByFeatured.findIndex((c) => !c.featured);
      if (firstUnfeaturedIndex !== -1) {
        const remainingAreUnfeatured = sortedByFeatured
          .slice(firstUnfeaturedIndex)
          .every((c) => !c.featured);
        expect(remainingAreUnfeatured).toBe(true);
      }
    });

    it('enriches collections and aggregates gear inventory with accurate shot counts', () => {
      const store = new MockStore();

      // Available cameras
      const cameras = store.getAvailableCameras();
      expect(cameras).toContain('Leica Q2');
      expect(cameras).toContain('Sony A7R V');
      expect(cameras).toContain('Fujifilm X-T5');
      expect(cameras).toContain('Hasselblad 907X 50C');

      // Enriched collections with capture counts
      const enrichedCols = store.getEnrichedCollections();
      expect(enrichedCols.length).toBe(3);
      const totalCounts = enrichedCols.reduce((acc, col) => acc + col.capture_count, 0);
      expect(totalCounts).toBe(store.getAllCaptures().length);
      for (const col of enrichedCols) {
        expect(col.capture_count).toBeGreaterThan(0);
        expect(col.cover_image_url).toBeTruthy();
      }

      // Gear inventory computation
      const gear = store.getGearInventory();
      expect(gear.length).toBeGreaterThan(0);
      for (const item of gear) {
        expect(item.name).toBeTruthy();
        expect(item.type).toMatch(/^(camera|lens)$/);
        expect(item.capture_count).toBeGreaterThanOrEqual(0);
      }
    });

    it('verifies defaultMockStore singleton provides ready-to-use fallback data', () => {
      expect(defaultMockStore.getAllCaptures().length).toBeGreaterThanOrEqual(8);
      expect(defaultMockStore.getAllCollections().length).toBe(3);
      expect(defaultMockStore.getGearInventory().length).toBeGreaterThanOrEqual(6);
    });
  });

  // =========================================================================
  // 5. POST /api/admin/sync Endpoint & Live Sync Pipeline
  // =========================================================================
  describe('5. POST /api/admin/sync Endpoint & Live Sync Contract', () => {
    it('handles batch ingestion with automatic insertion, updating, and in-batch deduplication', async () => {
      const mockEnv = createMockWorkerEnv();
      const initialDbSize = mockEnv._capturesStore.size;

      // 1. Batch payload with:
      // - 1 new capture
      // - 1 existing capture (brutalist-atrium-01) with updated title
      // - 1 duplicate new capture with same slug (tests in-batch deduplication)
      const payload = {
        captures: [
          {
            filePath: 'captures/architecture/new-tower.jpg',
            collection_slug: 'architecture',
            slug: 'new-tower',
            title: 'New Tower Initial',
            r2_key: 'captures/architecture/new-tower.jpg',
            exif: {
              camera_model: 'Leica Q2',
              width: 4000,
              height: 3000,
              focal_length: '28mm',
              aperture: 'f/2.8',
              shutter_speed: '1/250s',
              iso: 100,
              captured_at: '2026-04-10T10:00:00Z',
            },
          },
          {
            filePath: 'captures/architecture/brutalist-atrium-01.jpg',
            collection_slug: 'architecture',
            slug: 'brutalist-atrium-01',
            title: 'Updated Brutalist Atrium Title',
            r2_key: 'captures/architecture/brutalist-atrium-01.jpg',
            exif: {
              camera_model: 'Leica Q2',
              width: 3840,
              height: 2560,
            },
          },
          {
            filePath: 'captures/architecture/new-tower-variant.jpg',
            collection_slug: 'architecture',
            slug: 'new-tower', // duplicate slug in same batch!
            title: 'New Tower Final Revision',
            r2_key: 'captures/architecture/new-tower.jpg',
            exif: {
              camera_model: 'Leica Q2',
              width: 4000,
              height: 3000,
              iso: 200,
            },
          },
        ],
      };

      const res = await (await import('../../worker/index')).default.fetch(
        new Request('http://localhost/api/admin/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        mockEnv
      );

      expect(res.status).toBe(200);
      const resJson = (await res.json()) as { synced: number; inserted: number; updated: number };
      expect(resJson.synced).toBe(3);
      expect(resJson.inserted).toBe(1);
      expect(resJson.updated).toBe(2);

      // Verify that new-tower now has 'New Tower Final Revision'
      const updatedItem = Array.from(mockEnv._capturesStore.values()).find(
        (c) => c.slug === 'new-tower'
      );
      expect(updatedItem).toBeDefined();
      expect(updatedItem?.title).toBe('New Tower Final Revision');
      expect(updatedItem?.iso).toBe(200);

      // Verify that total store grew by exactly 1
      expect(mockEnv._capturesStore.size).toBe(initialDbSize + 1);
    });

    it('rejects invalid JSON request body on /api/admin/sync with HTTP 400', async () => {
      const mockEnv = createMockWorkerEnv();
      const res = await (await import('../../worker/index')).default.fetch(
        new Request('http://localhost/api/admin/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'not-valid-json',
        }),
        mockEnv
      );
      expect(res.status).toBe(400);
      const resJson = (await res.json()) as { error: string };
      expect(resJson.error).toMatch(/invalid sync json payload/i);
    });

    it('handles empty captures array on /api/admin/sync returning synced: 0', async () => {
      const mockEnv = createMockWorkerEnv();
      const res = await (await import('../../worker/index')).default.fetch(
        new Request('http://localhost/api/admin/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ captures: [] }),
        }),
        mockEnv
      );
      expect(res.status).toBe(200);
      const resJson = (await res.json()) as { synced: number; inserted: number; updated: number };
      expect(resJson).toEqual({ synced: 0, inserted: 0, updated: 0 });
    });

    it('executes live sync against mock Worker env with R2 asset upload and D1 persistence', async () => {
      const mockEnv = createMockWorkerEnv();

      const report = await runCliSync({
        dryRun: false,
        silent: true,
        workerEnv: mockEnv,
      });

      expect(report.dryRun).toBe(false);
      expect(report.items).toHaveLength(6);
      expect(report.result.synced).toBe(6);

      // Verify each item's binary was uploaded to R2 bucket
      for (const item of report.items) {
        expect(mockEnv._r2Store.has(item.r2_key)).toBe(true);
      }
    });
  });
});

