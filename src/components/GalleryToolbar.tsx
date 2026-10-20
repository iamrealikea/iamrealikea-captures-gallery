/**
 * src/components/GalleryToolbar.tsx
 *
 * Gallery toolbar from the Figma design: pill category filters on the left,
 * sort selector, divider and layout switcher on the right. Search and camera/gear
 * filters sit in a quiet secondary row beneath the toolbar.
 */

import React from 'react';
import {
  Camera,
  ChevronDown,
  Grid2x2,
  LayoutDashboard,
  List,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type {
  CollectionWithCount,
  GalleryFilters,
  SortOption,
  ViewMode,
} from '../types/gallery';

export interface GalleryToolbarProps {
  collections: CollectionWithCount[];
  totalCapturesCount: number;
  filteredCount: number;
  availableCameras: string[];
  filters: GalleryFilters;
  onUpdateFilters: (partial: Partial<GalleryFilters>) => void;
  onResetFilters: () => void;
}

const VIEW_MODES: {
  id: ViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'masonry', label: 'Aspect-ratio masonry grid', icon: LayoutDashboard },
  { id: 'square', label: 'Uniform square grid', icon: Grid2x2 },
  { id: 'editorial', label: 'Editorial list', icon: List },
];

const PILL_BASE =
  'inline-flex min-h-10 items-center gap-2 rounded-full px-[17px] py-[10px] text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2';
const PILL_ACTIVE = 'bg-ink font-medium text-white';
const PILL_IDLE = 'text-stone hover:text-ink';

const FIELD_CLASS =
  'min-h-10 w-full rounded-full border border-line bg-white px-4 text-[13px] text-ink placeholder:text-stone focus:border-ink focus:outline-none focus:ring-2 focus:ring-line';

export const GalleryToolbar: React.FC<GalleryToolbarProps> = ({
  collections,
  totalCapturesCount,
  availableCameras,
  filters,
  onUpdateFilters,
  onResetFilters,
}) => {
  const hasActiveFilters =
    Boolean(filters.collection && filters.collection !== 'all') ||
    Boolean(filters.search.trim()) ||
    Boolean(filters.camera && filters.camera !== 'all') ||
    filters.sort !== 'featured';

  const isAllSelected = !filters.collection || filters.collection === 'all';

  return (
    <section
      aria-label="Gallery filters and view controls"
      className="flex flex-col gap-5"
    >
      {/* Category filters + sorting and layout */}
      <div className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="group"
          aria-label="Filter by collection"
          className="flex flex-wrap items-center gap-1.5"
        >
          <button
            type="button"
            onClick={() => onUpdateFilters({ collection: null })}
            aria-pressed={isAllSelected}
            className={`${PILL_BASE} ${isAllSelected ? PILL_ACTIVE : PILL_IDLE}`}
          >
            <span>All photographs</span>
            <span className="text-[10px] opacity-70">{totalCapturesCount}</span>
          </button>

          {collections.map((col) => {
            const isSelected = filters.collection === col.slug;
            return (
              <button
                key={col.id}
                type="button"
                data-collection={col.slug}
                onClick={() =>
                  onUpdateFilters({
                    collection: isSelected ? null : col.slug,
                  })
                }
                aria-pressed={isSelected}
                className={`${PILL_BASE} ${isSelected ? PILL_ACTIVE : PILL_IDLE}`}
              >
                <span>{col.title}</span>
                <span className="text-[10px] opacity-70">
                  {col.capture_count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-6">
          {/* Sort order */}
          <div className="relative flex items-center">
            <label htmlFor="gallery-sort-select" className="sr-only">
              Sort order
            </label>
            <select
              id="gallery-sort-select"
              value={filters.sort}
              onChange={(e) =>
                onUpdateFilters({ sort: e.target.value as SortOption })
              }
              className="min-h-10 cursor-pointer appearance-none bg-transparent pr-6 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <option value="featured">Featured first</option>
              <option value="captured_desc">Capture date (newest)</option>
              <option value="created_desc">Newly added</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-0 h-[14px] w-[14px] text-stone"
              aria-hidden="true"
            />
          </div>

          <span className="h-5 w-px bg-line" aria-hidden="true" />

          {/* Layout switcher */}
          <div
            role="group"
            aria-label="Gallery view mode"
            className="flex items-center gap-1"
          >
            {VIEW_MODES.map((mode) => {
              const Icon = mode.icon;
              const isCurrent = filters.viewMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  aria-label={mode.label}
                  aria-pressed={isCurrent}
                  title={mode.label}
                  onClick={() => onUpdateFilters({ viewMode: mode.id })}
                  className={`inline-flex min-h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    isCurrent
                      ? 'bg-line/60 text-ink'
                      : 'text-stone hover:text-ink'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Secondary row: search, camera / gear, reset */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="sm:w-80">
          <label
            htmlFor="gallery-search-input"
            className="block text-xs font-medium text-stone"
          >
            Search captures
          </label>
          <div className="relative mt-1.5">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-stone"
              aria-hidden="true"
            />
            <input
              id="gallery-search-input"
              type="search"
              value={filters.search}
              onChange={(e) => onUpdateFilters({ search: e.target.value })}
              placeholder="Search title, location, camera, or tag..."
              className={`${FIELD_CLASS} pr-10 pl-10`}
            />
            {filters.search && (
              <button
                type="button"
                aria-label="Clear search query"
                onClick={() => onUpdateFilters({ search: '' })}
                className="absolute top-1/2 right-1.5 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-stone hover:bg-line/40 hover:text-ink focus-visible:outline-2"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="sm:w-64">
          <label
            htmlFor="gallery-camera-select"
            className="block text-xs font-medium text-stone"
          >
            <span className="inline-flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Camera or gear</span>
            </span>
          </label>
          <select
            id="gallery-camera-select"
            value={filters.camera || ''}
            onChange={(e) =>
              onUpdateFilters({ camera: e.target.value || null })
            }
            className={`${FIELD_CLASS} mt-1.5`}
          >
            <option value="">All cameras &amp; optics</option>
            {availableCameras.map((cam) => (
              <option key={cam} value={cam}>
                {cam}
              </option>
            ))}
            {filters.camera && !availableCameras.includes(filters.camera) && (
              <option value={filters.camera}>{filters.camera}</option>
            )}
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            aria-label="Reset all filters"
            title="Reset all filters"
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-line px-4 text-[13px] font-medium text-ink transition-colors hover:bg-line/40 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Reset</span>
          </button>
        )}
      </div>
    </section>
  );
};
