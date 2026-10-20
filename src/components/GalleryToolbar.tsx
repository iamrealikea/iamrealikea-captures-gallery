/**
 * src/components/GalleryToolbar.tsx
 *
 * Gallery filtering, search, sorting, camera/gear selector, and 3-mode view switcher
 * adhering strictly to DESIGN_SYSTEM.md.
 */

import React from 'react';
import {
  Camera,
  Columns,
  Grid,
  List,
  RotateCcw,
  Search,
  SlidersHorizontal,
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
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'masonry',
    label: 'Aspect-ratio masonry grid',
    shortLabel: 'Masonry',
    icon: Columns,
  },
  {
    id: 'square',
    label: 'Uniform square grid',
    shortLabel: 'Square',
    icon: Grid,
  },
  {
    id: 'editorial',
    label: 'Editorial list',
    shortLabel: 'Editorial',
    icon: List,
  },
];

export const GalleryToolbar: React.FC<GalleryToolbarProps> = ({
  collections,
  totalCapturesCount,
  filteredCount,
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

  return (
    <section
      aria-label="Gallery filters and view controls"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      {/* Top Row: Collection Filter Pills & 3-Mode View Switcher */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Collection Filter Pills */}
        <div
          role="group"
          aria-label="Filter by collection"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            onClick={() => onUpdateFilters({ collection: null })}
            aria-pressed={!filters.collection || filters.collection === 'all'}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              !filters.collection || filters.collection === 'all'
                ? 'border-blue-600 bg-blue-600 text-white font-semibold'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>All captures</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                !filters.collection || filters.collection === 'all'
                  ? 'bg-blue-700 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {totalCapturesCount}
            </span>
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
                className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  isSelected
                    ? 'border-blue-600 bg-blue-600 text-white font-semibold'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{col.title}</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                    isSelected
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {col.capture_count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3-Mode View Switcher */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <span className="text-xs font-medium text-slate-500">Layout:</span>
          <div
            role="group"
            aria-label="Gallery view mode"
            className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1"
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
                  onClick={() => onUpdateFilters({ viewMode: mode.id })}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                    isCurrent
                      ? 'bg-white text-blue-600 shadow-xs font-semibold border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{mode.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="my-4 border-t border-slate-200" />

      {/* Bottom Row: Search Input, Camera/Gear Selector, Sort Dropdown, and Status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
        {/* Search Input */}
        <div className="sm:col-span-2 lg:col-span-5">
          <label
            htmlFor="gallery-search-input"
            className="block text-sm font-medium text-slate-700"
          >
            Search captures
          </label>
          <div className="relative mt-1.5">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="gallery-search-input"
              type="search"
              value={filters.search}
              onChange={(e) => onUpdateFilters({ search: e.target.value })}
              placeholder="Search title, location, camera, or tag..."
              className="w-full min-h-10 rounded-lg border border-slate-300 bg-white pr-9 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {filters.search && (
              <button
                type="button"
                aria-label="Clear search query"
                onClick={() => onUpdateFilters({ search: '' })}
                className="absolute top-1/2 right-1.5 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Camera / Gear Filter Dropdown */}
        <div className="lg:col-span-3">
          <label
            htmlFor="gallery-camera-select"
            className="block text-sm font-medium text-slate-700"
          >
            <span className="inline-flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Camera or gear</span>
            </span>
          </label>
          <select
            id="gallery-camera-select"
            value={filters.camera || ''}
            onChange={(e) =>
              onUpdateFilters({ camera: e.target.value || null })
            }
            className="mt-1.5 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
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

        {/* Sort Selector */}
        <div className="lg:col-span-3">
          <label
            htmlFor="gallery-sort-select"
            className="block text-sm font-medium text-slate-700"
          >
            <span className="inline-flex items-center gap-1.5">
              <SlidersHorizontal
                className="h-3.5 w-3.5 text-slate-500"
                aria-hidden="true"
              />
              <span>Sort order</span>
            </span>
          </label>
          <select
            id="gallery-sort-select"
            value={filters.sort}
            onChange={(e) =>
              onUpdateFilters({ sort: e.target.value as SortOption })
            }
            className="mt-1.5 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="featured">Featured first</option>
            <option value="captured_desc">Capture date (newest)</option>
            <option value="created_desc">Newly added</option>
          </select>
        </div>

        {/* Reset Filters Button / Result Count */}
        <div className="flex items-center justify-between gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={onResetFilters}
              aria-label="Reset all filters"
              title="Reset all filters"
              className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span className="lg:sr-only">Reset</span>
            </button>
          ) : (
            <div
              className="text-right text-xs font-medium text-slate-500"
              aria-live="polite"
            >
              Showing {filteredCount} of {totalCapturesCount}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
