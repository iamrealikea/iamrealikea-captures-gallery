/**
 * src/components/PhotoLightboxDialog.tsx
 *
 * URL-synced (?photo=<slug>) native <dialog closedby="any"> modal lightbox
 * opened via showModal() with coordinate-boundary backdrop light-dismiss fallback,
 * keyboard navigation (ArrowLeft, ArrowRight, Escape), copy-share-link action,
 * and structured EXIF telemetry panel.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Aperture,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Focus,
  Gauge,
  Link2,
  MapPin,
  Maximize2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  formatAperture,
  formatFocalLength,
  formatIso,
  formatShutterSpeed,
  type Capture,
} from '../types/gallery';
import { createSvgPlaceholder } from '../utils/imagePlaceholder';

export interface PhotoLightboxDialogProps {
  capture: Capture | null;
  captures: Capture[];
  onClose: () => void;
  onSelectCapture: (capture: Capture) => void;
  onFilterByCamera?: (cameraModel: string) => void;
}

export const PhotoLightboxDialog: React.FC<PhotoLightboxDialogProps> = ({
  capture,
  captures,
  onClose,
  onSelectCapture,
  onFilterByCamera,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [copied, setCopied] = useState(false);

  const currentIndex = capture
    ? captures.findIndex((c) => c.id === capture.id || c.slug === capture.slug)
    : -1;

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < captures.length - 1;

  const handlePrev = () => {
    if (hasPrev) {
      onSelectCapture(captures[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      onSelectCapture(captures[currentIndex + 1]);
    }
  };

  // Reset copy state when switching captures
  useEffect(() => {
    setCopied(false);
  }, [capture?.id]);

  // Auto-reset copy state after 2500ms
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => {
      setCopied(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  // Open / close native <dialog> via showModal()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Ensure declarative light-dismiss attribute is set on DOM node
    dialog.setAttribute('closedby', 'any');

    if (capture) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          try {
            dialog.showModal();
          } catch {
            dialog.setAttribute('open', '');
          }
        } else {
          dialog.setAttribute('open', '');
        }
      }
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') {
        try {
          dialog.close();
        } catch {
          dialog.removeAttribute('open');
        }
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [capture]);

  // Keyboard navigation (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    if (!capture) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (currentIndex >= 0 && currentIndex < captures.length - 1) {
          onSelectCapture(captures[currentIndex + 1]);
        }
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (currentIndex > 0) {
          onSelectCapture(captures[currentIndex - 1]);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [capture, captures, currentIndex, onClose, onSelectCapture]);

  // Coordinate-boundary light-dismiss fallback for browsers without native `closedBy`
  const handleDialogBackdropClick = (
    event: React.MouseEvent<HTMLDialogElement>
  ) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // 1. When clicking the backdrop, the event target is the dialog element itself.
    if (event.target !== dialog) return;

    // 2. Check if the click coordinates fall within the dialog's content box.
    const rect = dialog.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const right = rect.right ?? rect.left + rect.width;
      const bottom = rect.bottom ?? rect.top + rect.height;

      const isOutside =
        event.clientX < rect.left ||
        event.clientX > right ||
        event.clientY < rect.top ||
        event.clientY > bottom;

      if (!isOutside) return;
    }

    // 3. Outside the content area (on the backdrop), close the dialog.
    if (typeof dialog.close === 'function') {
      try {
        dialog.close();
      } catch {
        // ignore
      }
    }
    onClose();
  };

  const handleCopyShareLink = async () => {
    if (!capture) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?photo=${encodeURIComponent(
      capture.slug
    )}`;
    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
    } catch {
      // Clipboard fallback ignored in restricted test environments
    }
    setCopied(true);
  };

  const formattedDate = capture?.captured_at
    ? new Date(capture.captured_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Date unrecorded';

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby="lightbox-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (capture) {
          onClose();
        }
      }}
      onClick={handleDialogBackdropClick}
      className="w-full max-w-6xl rounded-xl border border-slate-200 bg-white p-0 shadow-lg backdrop:bg-slate-900/75"
    >
      {capture && (
        <div
          data-testid="lightbox-content-container"
          className="flex max-h-[90vh] flex-col overflow-y-auto lg:flex-row lg:overflow-hidden"
        >
          {/* Left / Top Stage: High-Resolution Photograph Preview */}
          <div className="relative flex flex-1 items-center justify-center bg-slate-50 p-4 sm:p-8 lg:min-h-[560px]">
            <img
              src={capture.image_url}
              alt={capture.title}
              width={capture.width}
              height={capture.height}
              fetchPriority="high"
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
              style={{ viewTransitionName: 'photo-hero' }}
              className="max-h-[70vh] w-auto max-w-full rounded-lg border border-slate-200 object-contain shadow-xs"
            />

            {/* Previous / Next Navigation Controls */}
            {hasPrev && (
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous capture"
                className="absolute top-1/2 left-3 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white/95 text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
            )}

            {hasNext && (
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next capture"
                className="absolute top-1/2 right-3 -translate-y-1/2 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white/95 text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            )}

            {/* Sequence Counter Pill */}
            {currentIndex >= 0 && (
              <div className="absolute bottom-3 left-4 rounded-md border border-slate-200 bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-600">
                Frame {currentIndex + 1} of {captures.length}
              </div>
            )}
          </div>

          {/* Right Sidebar: Story Narrative & Structured EXIF Telemetry */}
          <div className="flex w-full flex-col justify-between border-t border-slate-200 bg-white p-5 sm:p-6 lg:w-96 lg: shrink-0 lg:overflow-y-auto lg:border-t-0 lg:border-l">
            <div className="space-y-6">
              {/* Header & Close Action */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {capture.collection_slug}
                    </span>
                    {capture.featured && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        <span>Featured</span>
                      </span>
                    )}
                  </div>
                  <h2
                    id="lightbox-title"
                    tabIndex={-1}
                    className="mt-2 text-xl font-bold text-slate-900 focus:outline-none"
                  >
                    {capture.title}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close lightbox"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* Location & Date */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                {capture.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    <span>{capture.location}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  <span>{formattedDate}</span>
                </span>
              </div>

              {/* Curatorial Story */}
              {capture.story && (
                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Field notes
                  </h3>
                  <p className="mt-2 max-w-[65ch] text-sm leading-6 text-slate-700">
                    {capture.story}
                  </p>
                </div>
              )}

              {/* Detailed EXIF Telemetry Panel */}
              <div
                aria-label="EXIF camera telemetry"
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    EXIF telemetry
                  </h3>
                  {capture.camera_model && onFilterByCamera && (
                    <button
                      type="button"
                      onClick={() => {
                        onFilterByCamera(capture.camera_model!);
                        onClose();
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
                    >
                      Filter by camera
                    </button>
                  )}
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-2.5">
                    <dt className="flex items-center gap-1.5 text-slate-500">
                      <Camera className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                      <span>Camera body</span>
                    </dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {capture.camera_model || '—'}
                    </dd>
                  </div>

                  <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-2.5">
                    <dt className="flex items-center gap-1.5 text-slate-500">
                      <Focus className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                      <span>Optics / lens</span>
                    </dt>
                    <dd className="mt-1 font-semibold text-slate-900">
                      {capture.lens_model || '—'}
                    </dd>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <dt className="text-slate-500">Focal length</dt>
                    <dd className="mt-1 font-mono font-semibold text-slate-900">
                      {formatFocalLength(capture.focal_length)}
                    </dd>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <dt className="flex items-center gap-1 text-slate-500">
                      <Aperture className="h-3 w-3" aria-hidden="true" />
                      <span>Aperture</span>
                    </dt>
                    <dd className="mt-1 font-mono font-semibold text-slate-900">
                      {formatAperture(capture.aperture)}
                    </dd>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <dt className="flex items-center gap-1 text-slate-500">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      <span>Shutter speed</span>
                    </dt>
                    <dd className="mt-1 font-mono font-semibold text-slate-900">
                      {formatShutterSpeed(capture.shutter_speed)}
                    </dd>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <dt className="flex items-center gap-1 text-slate-500">
                      <Gauge className="h-3 w-3" aria-hidden="true" />
                      <span>Sensitivity</span>
                    </dt>
                    <dd className="mt-1 font-mono font-semibold text-slate-900">
                      {formatIso(capture.iso)}
                    </dd>
                  </div>

                  <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-2.5">
                    <dt className="flex items-center gap-1.5 text-slate-500">
                      <Maximize2 className="h-3 w-3" aria-hidden="true" />
                      <span>Native resolution</span>
                    </dt>
                    <dd className="mt-1 font-mono font-semibold text-slate-900">
                      {capture.width} × {capture.height} px (aspect{' '}
                      {capture.aspect_ratio})
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Curated Tags */}
              {capture.tags && capture.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {capture.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Actions: Copy Share Link & Close */}
            <div className="mt-6 flex items-center gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {copied ? (
                  <>
                    <Check
                      className="h-4 w-4 text-green-600"
                      aria-hidden="true"
                    />
                    <span className="text-green-700">Share link copied</span>
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    <span>Copy share link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
};
