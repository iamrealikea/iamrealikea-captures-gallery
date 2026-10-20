/**
 * src/components/GalleryView.tsx
 *
 * Gallery page from the Figma design: "Photo of the day" hero, then the
 * "Recent work" section with toolbar, active layout mode (MasonryGrid, SquareGrid,
 * EditorialList) and an accessible empty state.
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
import { PhotoOfTheDay } from './PhotoOfTheDay';

export interface GalleryViewProps {
  captures: Capture[];
  totalCapturesCount: number;
  collections: CollectionWithCount[];
  availableCameras: string[];
  filters: GalleryFilters;
  onUpdateFilters: (partial: Partial<GalleryFilters>) => void;
  onResetFilters: () => void;
  onSelectCapture: (capture: Capture) => void;
  /** Full archive, used to pick the featured "Photo of the day" candidates. */
  allCaptures?: Capture[];
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
  allCaptures,
}) => {
  return (
    <div>
      <PhotoOfTheDay
        captures={allCaptures ?? captures}
        onSelectCapture={onSelectCapture}
      />

      <section
        id="recent-photographs"
        aria-labelledby="recent-work-heading"
        className="mx-auto flex w-full max-w-[1440px] flex-col gap-7 px-4 pb-16 sm:px-8 lg:px-16"
      >
        {/* Section heading */}
        <div className="mt-10 flex flex-col justify-between gap-2 border-t border-line pt-10 sm:flex-row sm:items-end">
          <div className="flex items-baseline gap-[13px]">
            <h2
              id="recent-work-heading"
              className="text-[28px] font-normal text-ink sm:text-4xl"
            >
              Recent work
            </h2>
            <span className="text-[11px] leading-8 text-stone">
              [{String(totalCapturesCount).padStart(2, '0')}]
            </span>
          </div>
          <p className="text-[13px] text-stone">
            Recent frames from my own archive.
          </p>
        </div>

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
            className="flex flex-col items-center justify-center border border-line bg-white px-6 py-16 text-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line text-stone">
              <ImageOff className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-medium text-ink">
              No captures match your current filters
            </h2>
            <p className="mt-1 max-w-md text-sm leading-5 text-stone">
              Try clearing your search query or switching to a different
              collection or camera body to restore the full photographic
              archive.
            </p>
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-6 inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-ink px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Reset filters</span>
            </button>
          </section>
        ) : (
          <div
            id="gallery-grid-container"
            tabIndex={-1}
            className="focus:outline-none"
          >
            {filters.viewMode === 'masonry' && (
              <MasonryGrid
                captures={captures}
                onSelectCapture={onSelectCapture}
              />
            )}
            {filters.viewMode === 'square' && (
              <SquareGrid
                captures={captures}
                onSelectCapture={onSelectCapture}
              />
            )}
            {filters.viewMode === 'editorial' && (
              <EditorialList
                captures={captures}
                onSelectCapture={onSelectCapture}
              />
            )}
          </div>
        )}

        <p
          className="pt-4 text-center text-[11px] text-stone"
          aria-live="polite"
        >
          Showing {captures.length} of {totalCapturesCount} frames
        </p>
      </section>
    </div>
  );
};
