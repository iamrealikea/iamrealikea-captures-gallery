/**
 * scripts/sync-captures.ts
 *
 * Pipeline A: Local Folder Sync CLI (`npm run sync`).
 * Scans `./captures/<collection-slug>/` for photographic image files,
 * extracts embedded EXIF telemetry and binary dimensions via `exifr`,
 * and syncs records to Cloudflare R2 and D1 (with `--dry-run` support).
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  extractExifMetadata,
  slugify,
  titleFromFilename,
} from '../src/utils/exifExtractor';
import type {
  BatchSyncItem,
  BatchSyncPayload,
  SyncResult,
} from '../src/types/gallery';
import worker, { type WorkerEnv } from '../worker/index';
import { createMockWorkerEnv } from '../worker/workerTypes';

const SUPPORTED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
]);

export interface SyncCliOptions {
  capturesDir?: string;
  dryRun?: boolean;
  endpoint?: string;
  jwtToken?: string;
  workerEnv?: WorkerEnv;
  silent?: boolean;
}

export interface SyncExecutionReport extends SyncResult {
  dryRun: boolean;
  items: BatchSyncItem[];
}

/**
 * Recursively scans `<capturesDir>/<collection-slug>/*` for image files
 * and extracts EXIF telemetry and dimensions.
 */
export async function scanLocalCaptures(
  capturesDir = path.resolve(process.cwd(), 'captures')
): Promise<BatchSyncItem[]> {
  if (!fs.existsSync(capturesDir)) {
    return [];
  }

  const entries = fs.readdirSync(capturesDir, { withFileTypes: true });
  const collectionDirs = entries
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const items: BatchSyncItem[] = [];

  for (const colDir of collectionDirs) {
    const collectionSlug = slugify(colDir.name);
    const colFullPath = path.join(capturesDir, colDir.name);
    const files = fs
      .readdirSync(colFullPath, { withFileTypes: true })
      .filter((f) => f.isFile())
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) {
        continue;
      }

      const fullFilePath = path.join(colFullPath, file.name);
      const relPath = path
        .relative(process.cwd(), fullFilePath)
        .replace(/\\/g, '/');
      const fileBuffer = fs.readFileSync(fullFilePath);
      const exif = await extractExifMetadata(new Uint8Array(fileBuffer));

      const slug = slugify(file.name);
      const title = titleFromFilename(file.name);
      const r2Key = `captures/${collectionSlug}/${file.name}`;

      items.push({
        filePath: relPath,
        collection_slug: collectionSlug,
        slug,
        title,
        r2_key: r2Key,
        exif,
      });
    }
  }

  return items;
}

/**
 * Executes the local folder sync pipeline either in `--dry-run` mode
 * or against the Cloudflare Worker `/api/admin/sync` handler.
 */
export async function runCliSync(
  options: SyncCliOptions = {}
): Promise<{
  dryRun: boolean;
  items: BatchSyncItem[];
  result: SyncResult;
}> {
  const capturesDir =
    options.capturesDir || path.resolve(process.cwd(), 'captures');
  const dryRun = Boolean(options.dryRun);
  const silent = Boolean(options.silent);

  if (!silent) {
    console.log('================================================================');
    console.log(
      `CAPTURES-GALLERY CLI SYNC ${dryRun ? '(DRY RUN)' : '(LIVE SYNC)'}`
    );
    console.log(`Scanning directory: ${capturesDir}`);
    console.log('================================================================');
  }

  const items = await scanLocalCaptures(capturesDir);

  if (!silent) {
    console.log(`Found ${items.length} capture(s) across collection folders:\n`);
    for (const item of items) {
      const dims =
        item.exif.width && item.exif.height
          ? `${item.exif.width}×${item.exif.height}`
          : 'unknown dims';
      const specs = [
        item.exif.camera_model || 'Unknown camera',
        item.exif.lens_model || null,
        item.exif.focal_length || null,
        item.exif.aperture || null,
        item.exif.shutter_speed || null,
        item.exif.iso ? `ISO ${item.exif.iso}` : null,
      ]
        .filter(Boolean)
        .join(' • ');

      console.log(
        `  [${item.collection_slug}] ${item.slug} (${dims})\n` +
          `    Title  : ${item.title}\n` +
          `    R2 Key : ${item.r2_key}\n` +
          `    EXIF   : ${specs}`
      );
    }
  }

  if (dryRun) {
    const dryResult: SyncResult = {
      synced: items.length,
      inserted: 0,
      updated: 0,
    };
    if (!silent) {
      console.log('\n----------------------------------------------------------------');
      console.log(
        `Dry run complete. ${items.length} capture(s) validated and ready to sync.`
      );
      console.log('----------------------------------------------------------------');
    }
    return { dryRun: true, items, result: dryResult };
  }

  const payload: BatchSyncPayload = { captures: items };
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.jwtToken) {
    headers['Cf-Access-Jwt-Assertion'] = options.jwtToken;
  }

  let syncResult: SyncResult;

  if (options.endpoint) {
    const response = await fetch(`${options.endpoint.replace(/\/$/, '')}/api/admin/sync`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Sync API failed with status ${response.status}`);
    }
    syncResult = (await response.json()) as SyncResult;
  } else {
    // Use local Cloudflare Worker handler with mock or provided bindings
    const env = options.workerEnv || createMockWorkerEnv();
    // Upload binary files to R2 bucket binding if present
    if (env.BUCKET) {
      for (const item of items) {
        const fullPath = path.resolve(process.cwd(), item.filePath);
        if (fs.existsSync(fullPath)) {
          const buf = fs.readFileSync(fullPath);
          await env.BUCKET.put(item.r2_key, new Uint8Array(buf), {
            httpMetadata: { contentType: 'image/jpeg' },
          });
        }
      }
    }

    const req = new Request('http://localhost/api/admin/sync', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const res = await worker.fetch(req, env);
    if (!res.ok) {
      throw new Error(`Local Worker sync failed with status ${res.status}`);
    }
    syncResult = (await res.json()) as SyncResult;
  }

  if (!silent) {
    console.log('\n----------------------------------------------------------------');
    console.log(
      `Sync complete: ${syncResult.synced} total (${syncResult.inserted} inserted, ${syncResult.updated} updated).`
    );
    console.log('----------------------------------------------------------------');
  }

  return { dryRun: false, items, result: syncResult };
}

// Execute when invoked directly via `npm run sync`
const isMain =
  process.argv[1] &&
  (process.argv[1].includes('sync-captures') ||
    process.argv[1].endsWith('sync-captures.ts'));

if (isMain) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const dirArgIdx = args.indexOf('--dir');
  const capturesDir =
    dirArgIdx !== -1 && args[dirArgIdx + 1]
      ? path.resolve(process.cwd(), args[dirArgIdx + 1])
      : undefined;
  const endpointArgIdx = args.indexOf('--endpoint');
  const endpoint =
    endpointArgIdx !== -1 && args[endpointArgIdx + 1]
      ? args[endpointArgIdx + 1]
      : process.env.SYNC_API_ENDPOINT;

  runCliSync({ capturesDir, dryRun, endpoint })
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error during captures sync:', err);
      process.exit(1);
    });
}
