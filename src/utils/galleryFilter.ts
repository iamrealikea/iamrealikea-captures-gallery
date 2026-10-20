/**
 * src/utils/galleryFilter.ts
 *
 * Pure filtering, sorting, collection enrichment, and gear aggregation utilities
 * shared between the React client and Cloudflare Worker API fallback.
 */

import type {
  Capture,
  Collection,
  CollectionWithCount,
  GalleryFilters,
  GearItem,
  SortOption,
} from '../types/gallery';

/**
 * Filters and sorts captures according to active gallery toolbar controls.
 */
export function filterAndSortCaptures(
  captures: Capture[],
  filters: Partial<GalleryFilters>
): Capture[] {
  const collectionFilter = filters.collection?.trim().toLowerCase() || null;
  const cameraFilter = filters.camera?.trim().toLowerCase() || null;
  const searchQuery = filters.search?.trim().toLowerCase() || '';
  const sort: SortOption = filters.sort || 'featured';

  const filtered = captures.filter((capture) => {
    // 1. Collection filter
    if (collectionFilter && collectionFilter !== 'all') {
      if (capture.collection_slug.toLowerCase() !== collectionFilter) {
        return false;
      }
    }

    // 2. Camera / Gear filter (matches camera_model or lens_model)
    if (cameraFilter && cameraFilter !== 'all') {
      const cam = (capture.camera_model || '').toLowerCase();
      const lens = (capture.lens_model || '').toLowerCase();
      if (cam !== cameraFilter && lens !== cameraFilter && !cam.includes(cameraFilter) && !lens.includes(cameraFilter)) {
        return false;
      }
    }

    // 3. Text search across title, location, camera, lens, story, and tags
    if (searchQuery.length > 0) {
      const haystack = [
        capture.title,
        capture.location || '',
        capture.camera_model || '',
        capture.lens_model || '',
        capture.story || '',
        capture.collection_slug,
        ...(capture.tags || []),
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(searchQuery)) {
        return false;
      }
    }

    return true;
  });

  return [...filtered].sort((a, b) => {
    if (sort === 'featured') {
      if (a.featured !== b.featured) {
        return a.featured ? -1 : 1;
      }
      const dateA = a.captured_at ? Date.parse(a.captured_at) : 0;
      const dateB = b.captured_at ? Date.parse(b.captured_at) : 0;
      return dateB - dateA;
    }

    if (sort === 'captured_desc') {
      const dateA = a.captured_at ? Date.parse(a.captured_at) : 0;
      const dateB = b.captured_at ? Date.parse(b.captured_at) : 0;
      return dateB - dateA;
    }

    // 'created_desc' (Newly added)
    const createdA = a.created_at ? Date.parse(a.created_at) : 0;
    const createdB = b.created_at ? Date.parse(b.created_at) : 0;
    return createdB - createdA;
  });
}

/**
 * Enriches collections with live capture counts and cover image URLs.
 */
export function enrichCollectionsWithCounts(
  collections: Collection[],
  captures: Capture[]
): CollectionWithCount[] {
  return [...collections]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((col) => {
      const matching = captures.filter(
        (c) => c.collection_slug.toLowerCase() === col.slug.toLowerCase()
      );
      const explicitCover = col.cover_capture_id
        ? captures.find((c) => c.id === col.cover_capture_id)
        : undefined;
      const coverCapture = explicitCover || matching[0] || null;

      return {
        ...col,
        capture_count: matching.length,
        cover_image_url: coverCapture ? coverCapture.image_url : null,
      };
    });
}

/**
 * Extracts unique camera models from the capture catalog for the toolbar filter dropdown.
 */
export function getAvailableCameras(captures: Capture[]): string[] {
  const set = new Set<string>();
  for (const c of captures) {
    if (c.camera_model && c.camera_model.trim()) {
      set.add(c.camera_model.trim());
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Dynamically updates capture counts for each item in the Gear & Optics Inventory.
 */
export function computeGearInventory(
  captures: Capture[],
  baseGear: GearItem[]
): GearItem[] {
  return baseGear.map((item) => {
    const target = item.name.toLowerCase();
    const count = captures.filter((c) => {
      if (item.type === 'camera') {
        return (c.camera_model || '').toLowerCase() === target;
      }
      return (c.lens_model || '').toLowerCase() === target;
    }).length;

    return {
      ...item,
      capture_count: count,
    };
  });
}
