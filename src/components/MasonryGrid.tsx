/**
 * src/components/MasonryGrid.tsx
 *
 * View Mode 1: Aspect-ratio Masonry Grid (Figma "Masonry gallery").
 * Preserves natural portrait, landscape, and square proportions using balanced CSS columns.
 * The hero is the page's LCP candidate, so every grid image uses loading="lazy" alone
 * (no fetchPriority) per optimize-image-priority.
 */

import React from 'react';
import { Sparkles } from 'lucide-react';
import type { Capture } from '../types/gallery';
import { SITE_CONFIG } from '../data/siteConfig';
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
          capture.camera_model,
          capture.focal_length,
          capture.aperture,
          capture.shutter_speed,
          capture.iso ? `ISO ${capture.iso}` : null,
        ]
          .filter(Boolean)
          .join(' • ');

        return (
          <article key={capture.id} className="mb-9 break-inside-avoid">
            <button
              type="button"
              onClick={() => onSelectCapture(capture)}
              aria-label={`Inspect ${capture.title}`}
              className="group flex w-full flex-col gap-[14px] text-left focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <div
                className="relative w-full overflow-hidden bg-line/40"
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
                  <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium tracking-wider text-ink uppercase">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    <span>Featured</span>
                  </span>
                )}
              </div>

              {/* Caption */}
              <div className="flex flex-col gap-[7px]">
                <h3 className="text-[17px] leading-snug font-medium text-ink">
                  {capture.title}
                </h3>
                <p className="text-xs text-stone">
                  {SITE_CONFIG.photographer}
                  {capture.location ? `  ·  ${capture.location}` : ''}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-[9px] tracking-wider text-stone uppercase">
                    {capture.collection_slug}
                  </span>
                  {exifLine && (
                    <span className="font-mono text-[10px] text-stone">
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
