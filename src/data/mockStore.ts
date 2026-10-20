/**
 * src/data/mockStore.ts
 *
 * Strongly-typed in-memory mock store for captures, collections, and gear,
 * fulfilling PROJECT.md Code Layout and supporting offline emulation
 * in both browser (npm run dev) and edge/testing environments.
 */

import { SEED_CAPTURES, SEED_COLLECTIONS, SEED_GEAR_INVENTORY } from './seedCaptures';
import type {
  Capture,
  Collection,
  CollectionWithCount,
  CreateCaptureInput,
  GalleryFilters,
  GearItem,
  UpdateCaptureInput,
} from '../types/gallery';
import {
  computeGearInventory,
  enrichCollectionsWithCounts,
  filterAndSortCaptures,
  getAvailableCameras,
} from '../utils/galleryFilter';

export interface MockStoreState {
  captures: Capture[];
  collections: Collection[];
  gearInventory: GearItem[];
}

export class MockStore {
  private captures: Map<string, Capture>;
  private collections: Map<string, Collection>;
  private gear: GearItem[];

  constructor(
    initialCaptures = SEED_CAPTURES,
    initialCollections = SEED_COLLECTIONS,
    initialGear = SEED_GEAR_INVENTORY
  ) {
    this.captures = new Map(initialCaptures.map((c) => [c.id, structuredClone(c)]));
    this.collections = new Map(initialCollections.map((col) => [col.id, structuredClone(col)]));
    this.gear = structuredClone(initialGear);
  }

  // --- Read Operations ---
  public getAllCaptures(): Capture[] {
    return Array.from(this.captures.values());
  }

  public getCaptureByIdOrSlug(idOrSlug: string): Capture | null {
    for (const cap of this.captures.values()) {
      if (cap.id === idOrSlug || cap.slug === idOrSlug) {
        return structuredClone(cap);
      }
    }
    return null;
  }

  public getFilteredCaptures(filters: Partial<GalleryFilters>): Capture[] {
    return filterAndSortCaptures(this.getAllCaptures(), filters);
  }

  public getAllCollections(): Collection[] {
    return Array.from(this.collections.values()).sort((a, b) => a.sort_order - b.sort_order);
  }

  public getEnrichedCollections(): CollectionWithCount[] {
    return enrichCollectionsWithCounts(this.getAllCollections(), this.getAllCaptures());
  }

  public getAvailableCameras(): string[] {
    return getAvailableCameras(this.getAllCaptures());
  }

  public getGearInventory(): GearItem[] {
    return computeGearInventory(this.getAllCaptures(), this.gear);
  }

  // --- Mutation Operations ---
  public createCapture(
    input: CreateCaptureInput & { id?: string; r2_key?: string; image_url?: string }
  ): Capture {
    const id = input.id || `cap-${crypto.randomUUID()}`;
    const slug =
      input.slug ||
      input.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const width = input.width > 0 ? input.width : 3840;
    const height = input.height > 0 ? input.height : 2560;
    const aspectRatio = input.aspect_ratio || Number((width / height).toFixed(2));

    const newCapture: Capture = {
      id,
      slug,
      title: input.title.trim(),
      story: input.story ?? null,
      collection_slug: input.collection_slug.trim(),
      r2_key: input.r2_key || `captures/${input.collection_slug}/${slug}.jpg`,
      image_url:
        input.image_url || `/api/media/captures/${input.collection_slug}/${slug}.jpg`,
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

    this.captures.set(newCapture.id, newCapture);
    return structuredClone(newCapture);
  }

  public updateCapture(idOrSlug: string, updates: UpdateCaptureInput): Capture {
    const existing = this.getCaptureByIdOrSlug(idOrSlug);
    if (!existing) {
      throw new Error(`Capture not found: ${idOrSlug}`);
    }

    const width =
      updates.width !== undefined && updates.width > 0
        ? updates.width
        : existing.width;
    const height =
      updates.height !== undefined && updates.height > 0
        ? updates.height
        : existing.height;

    const updated: Capture = {
      ...existing,
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      width,
      height,
      aspect_ratio:
        updates.aspect_ratio !== undefined
          ? updates.aspect_ratio
          : Number((width / height).toFixed(2)),
      tags: updates.tags !== undefined ? updates.tags : existing.tags,
      featured:
        updates.featured !== undefined
          ? Boolean(updates.featured)
          : existing.featured,
    };

    this.captures.set(existing.id, updated);
    return structuredClone(updated);
  }

  public deleteCapture(idOrSlug: string): boolean {
    const existing = this.getCaptureByIdOrSlug(idOrSlug);
    if (!existing) return false;
    return this.captures.delete(existing.id);
  }

  public reset(): void {
    this.captures = new Map(SEED_CAPTURES.map((c) => [c.id, structuredClone(c)]));
    this.collections = new Map(
      SEED_COLLECTIONS.map((col) => [col.id, structuredClone(col)])
    );
    this.gear = structuredClone(SEED_GEAR_INVENTORY);
  }
}

/** Singleton default instance for app-wide fallback */
export const defaultMockStore = new MockStore();
