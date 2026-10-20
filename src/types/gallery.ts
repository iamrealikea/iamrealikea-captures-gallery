/**
 * src/types/gallery.ts
 *
 * Core TypeScript contracts, data models, and EXIF telemetry definitions
 * for the personal photography gallery application.
 */

// ============================================================================
// Core Domain Models
// ============================================================================

/**
 * Curated photographic capture record used across client views,
 * lightbox telemetry, and Edge API responses.
 */
export interface Capture {
  /** Unique UUID identifier */
  id: string;
  /** URL-friendly slug used in deep-links (?photo=<slug>) */
  slug: string;
  /** Curated title of the photograph */
  title: string;
  /** Editorial narrative / curatorial statement */
  story: string | null;
  /** Collection slug foreign key (e.g. 'architecture', 'street', 'minimalism') */
  collection_slug: string;
  /** Object key path in Cloudflare R2 (e.g. 'captures/architecture/atrium.jpg') */
  r2_key: string;
  /** Publicly streamable image URL or /api/media/:key endpoint */
  image_url: string;
  /** Native pixel width */
  width: number;
  /** Native pixel height */
  height: number;
  /** width / height decimal ratio (e.g. 1.5 for 3:2 landscape, 0.67 for 2:3 portrait) */
  aspect_ratio: number;
  /** Location string (e.g. 'London, United Kingdom' or 'Shibuya, Tokyo') */
  location: string | null;
  /** ISO 8601 capture timestamp (e.g. '2026-03-15T14:22:00Z') */
  captured_at: string | null;
  /** Camera body model (e.g. 'Fujifilm X-T5', 'Leica Q2', 'Sony A7R V') */
  camera_model: string | null;
  /** Lens model name (e.g. 'Fujinon XF 33mm f/1.4 R LM WR') */
  lens_model: string | null;
  /** Focal length with unit (e.g. '33mm', '28mm') */
  focal_length: string | null;
  /** Aperture value formatted (e.g. 'f/1.4', 'f/2.8', 'f/8') */
  aperture: string | null;
  /** Shutter speed value formatted (e.g. '1/500s', '1/250s', '1/4s') */
  shutter_speed: string | null;
  /** ISO speed sensitivity integer (e.g. 100, 125, 800, 1600) */
  iso: number | null;
  /** Curated topic and genre tags */
  tags: string[];
  /** Flag for prominent display in curated featured showcase */
  featured: boolean;
  /** Record creation timestamp */
  created_at: string;
}

/**
 * Photography collection record matching Cloudflare D1 schema.
 */
export interface Collection {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_capture_id: string | null;
  sort_order: number;
  created_at: string;
}

/**
 * Collection enriched with capture count and cover image URL for UI display.
 */
export interface CollectionWithCount extends Collection {
  capture_count: number;
  cover_image_url?: string | null;
}

/**
 * Photographic equipment item for the interactive Gear & Optics Inventory.
 */
export interface GearItem {
  id: string;
  name: string;
  type: 'camera' | 'lens';
  brand: string;
  sensor_or_mount: string;
  specs: string;
  capture_count: number;
  description?: string | null;
  image_url?: string | null;
}

/**
 * Camera technical telemetry extracted from image EXIF markers or form input.
 */
export interface ExifMetadata {
  camera_make?: string | null;
  camera_model?: string | null;
  lens_model?: string | null;
  focal_length?: string | null;
  aperture?: string | null;
  shutter_speed?: string | null;
  iso?: number | null;
  captured_at?: string | null;
  width?: number | null;
  height?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

// ============================================================================
// UI & View State Types
// ============================================================================

/** 3-Mode Gallery View Switcher */
export type ViewMode = 'masonry' | 'square' | 'editorial';

/** Sort selector options */
export type SortOption = 'featured' | 'captured_desc' | 'created_desc';

/** Top-level navigation views */
export type ActiveView = 'gallery' | 'collections' | 'about' | 'admin';

/** Active filter states on the Gallery toolbar */
export interface GalleryFilters {
  collection: string | null;
  search: string;
  camera: string | null;
  sort: SortOption;
  viewMode: ViewMode;
}

// ============================================================================
// Cloudflare D1 Database Row Contracts
// ============================================================================

/**
 * Raw D1 SQLite table row for captures.
 * Handles database-native storage where tags are stored as JSON TEXT
 * and featured is stored as 0 or 1 INTEGER.
 */
export interface CaptureRow {
  id: string;
  slug: string;
  title: string;
  story: string | null;
  collection_slug: string;
  r2_key: string;
  image_url: string;
  width: number;
  height: number;
  aspect_ratio: number;
  location: string | null;
  captured_at: string | null;
  camera_model: string | null;
  lens_model: string | null;
  focal_length: string | null;
  aperture: string | null;
  shutter_speed: string | null;
  iso: number | null;
  tags_json: string;
  featured: number;
  created_at: string;
}

/**
 * Raw D1 SQLite table row for collections.
 */
export interface CollectionRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_capture_id: string | null;
  sort_order: number;
  created_at: string;
}

// ============================================================================
// Serialization & Conversion Helpers
// ============================================================================

/**
 * Safely converts a raw D1 SQLite CaptureRow into a strongly-typed Capture.
 * Excludes internal tags_json from the domain object and guarantees valid tags array and boolean featured.
 */
export function rowToCapture(row: CaptureRow): Capture {
  const { tags_json, ...rest } = row;

  let tags: string[] = [];
  try {
    if (tags_json) {
      tags = JSON.parse(tags_json);
    }
  } catch {
    tags = [];
  }

  return {
    ...rest,
    tags: Array.isArray(tags) ? tags : [],
    featured: Boolean(rest.featured)
  };
}

/**
 * Converts a domain Capture or payload into a D1-ready CaptureRow.
 */
export function captureToRow(capture: Partial<Capture>): Partial<CaptureRow> {
  const row: Partial<CaptureRow> = { ...capture } as unknown as Partial<CaptureRow>;
  if (capture.tags !== undefined) {
    row.tags_json = JSON.stringify(capture.tags);
    delete (row as unknown as { tags?: unknown }).tags;
  }
  if (capture.featured !== undefined) {
    row.featured = capture.featured ? 1 : 0;
  }
  return row;
}

// ============================================================================
// Ingestion, Admin & API Payloads
// ============================================================================

/**
 * Payload sent to POST /api/admin/captures to create a new capture.
 */
export interface CreateCaptureInput {
  title: string;
  slug?: string;
  story?: string | null;
  collection_slug: string;
  location?: string | null;
  captured_at?: string | null;
  camera_model?: string | null;
  lens_model?: string | null;
  focal_length?: string | null;
  aperture?: string | null;
  shutter_speed?: string | null;
  iso?: number | null;
  width: number;
  height: number;
  aspect_ratio?: number;
  tags?: string[];
  featured?: boolean;
  r2_key?: string;
  image_url?: string;
  mime_type?: string;
  file_size?: number;
}

/**
 * Payload sent to PUT /api/admin/captures/:id to update an existing capture.
 */
export type UpdateCaptureInput = Partial<CreateCaptureInput>;

/**
 * Item passed in POST /api/admin/sync by the folder sync CLI.
 */
export interface BatchSyncItem {
  filePath: string;
  collection_slug: string;
  slug: string;
  title: string;
  r2_key: string;
  exif: ExifMetadata;
}

export interface BatchSyncPayload {
  captures: BatchSyncItem[];
}

export interface SyncResult {
  synced: number;
  inserted: number;
  updated: number;
}

/**
 * Response from GET /api/auth/session.
 */
export interface AuthSession {
  authenticated: boolean;
  email: string | null;
  mode: 'production-jwt' | 'development-bypass' | 'unauthenticated' | string;
}

// ============================================================================
// EXIF Telemetry Formatters
// ============================================================================

export function formatAperture(fNumber: number | string | null | undefined): string {
  if (fNumber === null || fNumber === undefined || fNumber === '') return '—';
  if (typeof fNumber === 'string') {
    return fNumber.startsWith('f/') ? fNumber : `f/${fNumber}`;
  }
  return `f/${fNumber.toFixed(1).replace(/\.0$/, '')}`;
}

export function formatShutterSpeed(speed: number | string | null | undefined): string {
  if (speed === null || speed === undefined || speed === '') return '—';
  if (typeof speed === 'string') {
    return speed.endsWith('s') ? speed : `${speed}s`;
  }
  if (speed >= 1) {
    return `${speed}s`;
  }
  const denominator = Math.round(1 / speed);
  return `1/${denominator}s`;
}

export function formatFocalLength(length: number | string | null | undefined): string {
  if (length === null || length === undefined || length === '') return '—';
  if (typeof length === 'string') {
    return length.endsWith('mm') ? length : `${length}mm`;
  }
  return `${Math.round(length)}mm`;
}

export function formatIso(iso: number | string | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '—';
  return `ISO ${iso}`;
}
