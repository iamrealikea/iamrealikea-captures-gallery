/**
 * src/components/EditorialList.tsx
 *
 * View Mode 3: Editorial List.
 * Horizontal rows with photo thumbnail, story excerpt (max 65ch with text-wrap: pretty),
 * tags, and complete EXIF telemetry summary.
 */

import React from 'react';
import {
  ArrowUpRight,
  Calendar,
  Camera,
  MapPin,
  Sparkles,
} from 'lucide-react';
import {
  formatAperture,
  formatFocalLength,
  formatIso,
  formatShutterSpeed,
  type Capture,
} from '../types/gallery';
import { createSvgPlaceholder } from '../utils/imagePlaceholder';

export interface EditorialListProps {
  captures: Capture[];
  onSelectCapture: (capture: Capture) => void;
}

export const EditorialList: React.FC<EditorialListProps> = ({
  captures,
  onSelectCapture,
}) => {
  return (
    <div
      data-testid="gallery-editorial-list"
      className="divide-y divide-line overflow-hidden rounded-none border border-line bg-white "
    >
      {captures.map((capture, index) => {
        const isLcpCandidate = index === 0;
        const formattedDate = capture.captured_at
          ? new Date(capture.captured_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : null;

        return (
          <article
            key={capture.id}
            className="p-5 transition-colors hover:bg-paper sm:p-6"
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              {/* Thumbnail Preview */}
              <button
                type="button"
                onClick={() => onSelectCapture(capture)}
                aria-label={`Inspect ${capture.title}`}
                className="group relative aspect-3/2 w-full shrink-0 overflow-hidden rounded-none border border-line bg-line/40 sm:w-60 focus-visible:outline-2 focus-visible:outline-offset-2"
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
                      600,
                      400
                    );
                    if (target.src !== fallback) {
                      target.src = fallback;
                    }
                  }}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </button>

              {/* Editorial Story & Telemetry Details */}
              <div className="flex flex-1 flex-col justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone">
                    <span className="rounded-md bg-line/40 px-2 py-0.5 text-stone">
                      {capture.collection_slug}
                    </span>
                    {capture.featured && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-line/40 px-2 py-0.5 text-ink">
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        <span>Featured</span>
                      </span>
                    )}
                    {capture.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" aria-hidden="true" />
                        <span>{capture.location}</span>
                      </span>
                    )}
                    {formattedDate && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        <span>{formattedDate}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="mt-1.5 text-lg font-semibold text-ink">
                    <button
                      type="button"
                      onClick={() => onSelectCapture(capture)}
                      className="inline-flex items-center gap-1.5 text-left hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <span>{capture.title}</span>
                      <ArrowUpRight
                        className="h-4 w-4 text-stone"
                        aria-hidden="true"
                      />
                    </button>
                  </h3>

                  {capture.story && (
                    <p className="mt-2 max-w-[65ch] text-sm leading-6 text-stone">
                      {capture.story}
                    </p>
                  )}
                </div>

                {/* Complete EXIF Telemetry Bar */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <div className="inline-flex flex-wrap items-center gap-2 rounded-none border border-line bg-paper px-3 py-1.5 text-xs text-stone">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                      <Camera
                        className="h-3.5 w-3.5 text-ink"
                        aria-hidden="true"
                      />
                      <span>{capture.camera_model || 'Archival body'}</span>
                    </span>
                    {capture.lens_model && (
                      <>
                        <span className="text-stone">•</span>
                        <span>{capture.lens_model}</span>
                      </>
                    )}
                    {capture.focal_length && (
                      <>
                        <span className="text-stone">•</span>
                        <span className="font-mono">
                          {formatFocalLength(capture.focal_length)}
                        </span>
                      </>
                    )}
                    {capture.aperture && (
                      <>
                        <span className="text-stone">•</span>
                        <span className="font-mono">
                          {formatAperture(capture.aperture)}
                        </span>
                      </>
                    )}
                    {capture.shutter_speed && (
                      <>
                        <span className="text-stone">•</span>
                        <span className="font-mono">
                          {formatShutterSpeed(capture.shutter_speed)}
                        </span>
                      </>
                    )}
                    {capture.iso && (
                      <>
                        <span className="text-stone">•</span>
                        <span className="font-mono">{formatIso(capture.iso)}</span>
                      </>
                    )}
                    <span className="text-stone">•</span>
                    <span className="font-mono text-stone">
                      {capture.width}×{capture.height}
                    </span>
                  </div>

                  {/* Tags */}
                  {capture.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-line bg-white px-2 py-1 text-xs font-medium text-stone"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};
