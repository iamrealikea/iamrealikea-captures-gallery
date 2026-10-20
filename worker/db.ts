/**
 * worker/db.ts
 *
 * Cloudflare D1 query execution helpers for captures and collections,
 * fulfilling PROJECT.md Code Layout and isolating relational database logic.
 */

import {
  rowToCapture,
  type Capture,
  type CaptureRow,
  type Collection,
  type CollectionRow,
} from './workerTypes';
import { SEED_CAPTURES, SEED_COLLECTIONS } from '../src/data/seedCaptures';

/**
 * Retrieves all captures directly from the D1 database.
 */
export async function getCapturesFromDb(db: D1Database): Promise<Capture[]> {
  const result = await db.prepare('SELECT * FROM captures').all<CaptureRow>();
  return (result.results || []).map(rowToCapture);
}

/**
 * Retrieves a single capture by UUID or slug directly from D1.
 */
export async function getCaptureByIdFromDb(
  db: D1Database,
  idOrSlug: string
): Promise<Capture | null> {
  try {
    const result = await db
      .prepare('SELECT * FROM captures WHERE id = ? OR slug = ? LIMIT 1')
      .bind(idOrSlug, idOrSlug)
      .first<CaptureRow>();

    if (result && (result.id === idOrSlug || result.slug === idOrSlug)) {
      return rowToCapture(result);
    }
  } catch {
    // Fall back to scanning all rows if driver or mock does not support WHERE in prepare
  }

  const all = await getCapturesFromDb(db);
  return all.find((c) => c.id === idOrSlug || c.slug === idOrSlug) ?? null;
}

/**
 * Retrieves all collections sorted by sort_order ascending directly from D1.
 */
export async function getCollectionsFromDb(db: D1Database): Promise<Collection[]> {
  const result = await db
    .prepare('SELECT * FROM collections ORDER BY sort_order ASC')
    .all<CollectionRow>();
  return result.results || [];
}

/**
 * Inserts a new capture into D1.
 */
export async function insertCaptureIntoDb(
  db: D1Database,
  capture: Capture
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO captures (
        id, slug, title, story, collection_slug, r2_key, image_url,
        width, height, aspect_ratio, location, captured_at,
        camera_model, lens_model, focal_length, aperture, shutter_speed,
        iso, tags_json, featured, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      capture.id,
      capture.slug,
      capture.title,
      capture.story,
      capture.collection_slug,
      capture.r2_key,
      capture.image_url,
      capture.width,
      capture.height,
      capture.aspect_ratio,
      capture.location,
      capture.captured_at,
      capture.camera_model,
      capture.lens_model,
      capture.focal_length,
      capture.aperture,
      capture.shutter_speed,
      capture.iso,
      JSON.stringify(capture.tags || []),
      capture.featured ? 1 : 0,
      capture.created_at
    )
    .run();
}

/**
 * Updates an existing capture in D1 by its ID.
 */
export async function updateCaptureInDb(
  db: D1Database,
  capture: Capture
): Promise<void> {
  await db
    .prepare(
      `UPDATE captures SET
        slug = ?, title = ?, story = ?, collection_slug = ?, r2_key = ?, image_url = ?,
        width = ?, height = ?, aspect_ratio = ?, location = ?, captured_at = ?,
        camera_model = ?, lens_model = ?, focal_length = ?, aperture = ?, shutter_speed = ?,
        iso = ?, tags_json = ?, featured = ?
      WHERE id = ?`
    )
    .bind(
      capture.slug,
      capture.title,
      capture.story,
      capture.collection_slug,
      capture.r2_key,
      capture.image_url,
      capture.width,
      capture.height,
      capture.aspect_ratio,
      capture.location,
      capture.captured_at,
      capture.camera_model,
      capture.lens_model,
      capture.focal_length,
      capture.aperture,
      capture.shutter_speed,
      capture.iso,
      JSON.stringify(capture.tags || []),
      capture.featured ? 1 : 0,
      capture.id
    )
    .run();
}

/**
 * Deletes a capture from D1 by its primary key ID.
 */
export async function deleteCaptureFromDb(
  db: D1Database,
  id: string
): Promise<void> {
  await db.prepare('DELETE FROM captures WHERE id = ?').bind(id).run();
}

/**
 * High-level helper: loads all captures from D1 with graceful fallback to SEED_CAPTURES.
 */
export async function loadAllCaptures(env: { DB?: D1Database }): Promise<Capture[]> {
  if (env.DB) {
    try {
      const captures = await getCapturesFromDb(env.DB);
      if (captures.length > 0) {
        return captures;
      }
    } catch {
      // Fall back to seed captures if D1 schema uninitialized or error occurs
    }
  }
  return structuredClone(SEED_CAPTURES);
}

/**
 * High-level helper: loads all collections from D1 with graceful fallback to SEED_COLLECTIONS.
 */
export async function loadAllCollections(env: { DB?: D1Database }): Promise<Collection[]> {
  if (env.DB) {
    try {
      const collections = await getCollectionsFromDb(env.DB);
      if (collections.length > 0) {
        return collections;
      }
    } catch {
      // Fall back to seed collections if D1 schema uninitialized or error occurs
    }
  }
  return structuredClone(SEED_COLLECTIONS);
}

// Backward compatibility aliases
export const insertCaptureInD1 = insertCaptureIntoDb;
export const updateCaptureInD1 = updateCaptureInDb;
