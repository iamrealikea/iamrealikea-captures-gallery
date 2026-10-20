/**
 * src/components/SquareGrid.tsx
 *
 * View Mode 2: Uniform Square Grid (1:1 Contact-Sheet Frames).
 * Standardizes presentation in aspect-square frames inspired by medium-format contact sheets.
 */

import React from 'react';
import { Camera, Maximize2, Sparkles } from 'lucide-react';
import type { Capture } from '../types/gallery';
import { createSvgPlaceholder } from '../utils/imagePlaceholder';

export interface SquareGridProps {
  captures: Capture[];
  onSelectCapture: (capture: Capture) => void;
}

export const SquareGrid: React.FC<SquareGridProps> = ({
  captures,
  onSelectCapture,
}) => {
  return (
    <div
      data-testid="gallery-square-grid"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {captures.map((capture, index) => {
        const isLcpCandidate = index === 0;
        const frameNumber = String(index + 1).padStart(2, '0');
        const exifCompact = [
          capture.focal_length,
          capture.aperture,
          capture.shutter_speed,
        ]
          .filter(Boolean)
          .join(' • ');

        return (
          <article
            key={capture.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300"
          >
            <button
              type="button"
              onClick={() => onSelectCapture(capture)}
              aria-label={`Inspect ${capture.title}`}
              className="group flex h-full w-full flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {/* Contact Sheet Frame Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-500">
                <span className="font-mono">FRAME #{frameNumber}</span>
                <span>{capture.collection_slug}</span>
              </div>

              {/* 1:1 Square Frame */}
              <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
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
                      800,
                      800
                    );
                    if (target.src !== fallback) {
                      target.src = fallback;
                    }
                  }}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
                {capture.featured && (
                  <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white/95 px-2 py-0.5 text-xs font-medium text-slate-900">
                    <Sparkles
                      className="h-3 w-3 text-blue-600"
                      aria-hidden="true"
                    />
                    <span>Featured</span>
                  </span>
                )}

                {/* Contact Sheet Hover Overlay */}
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  aria-hidden="true"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-white shadow-xs backdrop-blur-sm">
                    <Maximize2 className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                    <span>Inspect frame</span>
                  </span>
                </div>
              </div>

              {/* Caption & EXIF Footer */}
              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600">
                    {capture.title}
                  </h3>
                  {capture.location && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {capture.location}
                    </p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 truncate font-medium text-slate-700">
                    <Camera className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="truncate">
                      {capture.camera_model || 'Camera'}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px]">
                    {exifCompact}
                  </span>
                </div>
              </div>
            </button>
          </article>
        );
      })}
    </div>
  );
};
