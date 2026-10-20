/**
 * src/components/GalleryView.tsx
 *
 * Container orchestrating the Gallery Toolbar, active layout mode
 * (MasonryGrid, SquareGrid, EditorialList), and accessible empty state.
 */

import React from 'react';
import { ImageOff, RotateCcw } from 'lucide-react';
import type {
  Capture,
  CollectionWithCount,
  GalleryFilters,
} from '../types/gallery';
import { GalleryToolbar } from './GalleryToolbar';
import { MasonryGrid } from './MasonryGrid';
import { SquareGrid } from './SquareGrid';
import { EditorialList } from './EditorialList';

export interface GalleryViewProps {
  captures: Capture[];
  totalCapturesCount: number;
  collections: CollectionWithCount[];
  availableCameras: string[];
  filters: GalleryFilters;
  onUpdateFilters: (partial: Partial<GalleryFilters>) => void;
  onResetFilters: () => void;
  onSelectCapture: (capture: Capture) => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  captures,
  totalCapturesCount,
  collections,
  availableCameras,
  filters,
  onUpdateFilters,
  onResetFilters,
  onSelectCapture,
}) => {
  return (
    <div className="space-y-8">
      {/* Page Hero Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <h1
            id="gallery-view-heading"
            tabIndex={-1}
            className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl focus:outline-none"
          >
            Curated visual archive
          </h1>
          <p className="mt-2 max-w-[65ch] text-base leading-6 text-slate-600">
            Architectural geometry, nocturnal street frames, and minimalist
            studies accompanied by full camera and optical EXIF telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>
            Displaying{' '}
            <strong className="font-semibold text-slate-900">
              {captures.length}
            </strong>{' '}
            of {totalCapturesCount} captures
          </span>
        </div>
      </div>

      {/* Gallery Filter & View Mode Toolbar */}
      <GalleryToolbar
        collections={collections}
        totalCapturesCount={totalCapturesCount}
        filteredCount={captures.length}
        availableCameras={availableCameras}
        filters={filters}
        onUpdateFilters={onUpdateFilters}
        onResetFilters={onResetFilters}
      />

      {/* Active Gallery Layout Engine or Empty State */}
      {captures.length === 0 ? (
        <section
          aria-label="No matching captures"
          className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-6 py-16 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-xs">
            <ImageOff className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            No captures match your current filters
          </h2>
          <p className="mt-1 max-w-md text-sm leading-5 text-slate-600">
            Try clearing your search query or switching to a different
            collection or camera body to restore the full photographic archive.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-6 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Reset filters</span>
          </button>
        </section>
      ) : (
        <div id="gallery-grid-container" tabIndex={-1} className="focus:outline-none">
          {filters.viewMode === 'masonry' && (
            <MasonryGrid
              captures={captures}
              onSelectCapture={onSelectCapture}
            />
          )}
          {filters.viewMode === 'square' && (
            <SquareGrid captures={captures} onSelectCapture={onSelectCapture} />
          )}
          {filters.viewMode === 'editorial' && (
            <EditorialList
              captures={captures}
              onSelectCapture={onSelectCapture}
            />
          )}
        </div>
      )}
    </div>
  );
};
