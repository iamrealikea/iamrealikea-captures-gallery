/**
 * src/components/MasonryGrid.tsx
 *
 * View Mode 1: Aspect-ratio Masonry Grid.
 * Preserves natural portrait, landscape, and square proportions using balanced CSS columns.
 * Enforces optimize-image-priority: fetchPriority="high" (no loading="lazy") on the first LCP image,
 * and loading="lazy" (no fetchPriority) on subsequent images.
 */

import React from 'react';
import { Camera, MapPin, Sparkles } from 'lucide-react';
import type { Capture } from '../types/gallery';
import { createSvgPlaceholder } from '../utils/imagePlaceholder';

export interface MasonryGridProps {
  captures: Capture[];
  onSelectCapture: (capture: Capture) => void;
}

export const MasonryGrid: React.FC<MasonryGridProps> = ({
  captures,
  onSelectCapture,
}) => {
  return (
    <div
      data-testid="gallery-masonry-grid"
      className="columns-1 gap-6 sm:columns-2 lg:columns-3"
    >
      {captures.map((capture, index) => {
        const isLcpCandidate = index === 0;
        const exifLine = [
          capture.focal_length,
          capture.aperture,
          capture.shutter_speed,
          capture.iso ? `ISO ${capture.iso}` : null,
        ]
          .filter(Boolean)
          .join(' • ');

        return (
          <article
            key={capture.id}
            className="mb-6 break-inside-avoid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300"
          >
            <button
              type="button"
              onClick={() => onSelectCapture(capture)}
              aria-label={`Inspect ${capture.title}`}
              className="group block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <div
                className="relative w-full overflow-hidden bg-slate-100"
                style={{
                  aspectRatio: `${capture.width} / ${capture.height}`,
                }}
              >
                <img
                  src={capture.image_url}
                  alt={capture.title}
                  width={capture.width}
                  height={capture.height}
                  {...(isLcpCandidate
                    ? { fetchPriority: 'high' }
                    : { loading: 'lazy' })}
                  onError={(e) => {
                    const target = e.currentTarget;
                    const fallback = createSvgPlaceholder(
                      capture.title,
                      capture.collection_slug,
                      capture.width,
                      capture.height
                    );
                    if (target.src !== fallback) {
                      target.src = fallback;
                    }
                  }}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                />
                {capture.featured && (
                  <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-md border border-slate-200/80 bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-900 shadow-xs">
                    <Sparkles
                      className="h-3 w-3 text-blue-600"
                      aria-hidden="true"
                    />
                    <span>Featured</span>
                  </span>
                )}
              </div>

              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-600">
                    {capture.title}
                  </h3>
                  <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {capture.collection_slug}
                  </span>
                </div>

                {capture.location && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span>{capture.location}</span>
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                    <Camera className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>{capture.camera_model || 'Archival capture'}</span>
                  </span>
                  {exifLine && (
                    <span className="font-mono text-[11px] text-slate-500">
                      {exifLine}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </article>
        );
      })}
    </div>
  );
};
