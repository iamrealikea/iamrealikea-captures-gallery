/**
 * src/components/CollectionsView.tsx
 *
 * Curated photography series view displaying collection statements,
 * cover captures, frame counts, and camera gear summaries.
 * Clicking a collection filters the gallery and transitions smoothly.
 */

import React from 'react';
import { ArrowRight, Camera, FolderKanban, Layers } from 'lucide-react';
import type { Capture, CollectionWithCount } from '../types/gallery';
import { createSvgPlaceholder } from '../utils/imagePlaceholder';

export interface CollectionsViewProps {
  collections: CollectionWithCount[];
  captures: Capture[];
  onSelectCollection: (collectionSlug: string) => void;
}

export const CollectionsView: React.FC<CollectionsViewProps> = ({
  collections,
  captures,
  onSelectCollection,
}) => {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-6">
        <h1
          id="collections-view-heading"
          tabIndex={-1}
          className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl focus:outline-none"
        >
          Curated collections
        </h1>
        <p className="mt-2 max-w-[65ch] text-base leading-6 text-slate-600 text-pretty">
          Thematic photographic series organized around architectural form,
          nocturnal urban transit, and quiet atmospheric studies.
        </p>
      </div>

      {/* Empty State Fallback */}
      {collections.length === 0 ? (
        <section
          aria-label="No collections found"
          className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-6 py-16 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-xs">
            <FolderKanban className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            No collections available
          </h2>
          <p className="mt-1 max-w-md text-sm leading-5 text-slate-600 text-pretty">
            Curated photographic series are currently being indexed or synchronized.
          </p>
        </section>
      ) : (
        /* Collection Cards Grid (responsive 1 -> 2 -> 3 columns) */
        <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection, index) => {
            const isLcp = index === 0;
            const collectionCaptures = captures.filter(
              (c) =>
                c.collection_slug.toLowerCase() === collection.slug.toLowerCase()
            );
            const camerasInSeries = Array.from(
              new Set(
                collectionCaptures
                  .map((c) => c.camera_model)
                  .filter((m): m is string => Boolean(m))
              )
            );
            const coverUrl =
              collection.cover_image_url ||
              createSvgPlaceholder(collection.title, collection.slug, 1200, 800);

            return (
              <section
                key={collection.id}
                data-testid={`collection-card-${collection.slug}`}
                className="flex flex-col justify-between overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300"
              >
                <div>
                  {/* Cover Photograph */}
                  <div className="relative aspect-3/2 w-full overflow-hidden bg-slate-100">
                    <img
                      src={coverUrl}
                      alt={`${collection.title} cover`}
                      width={1200}
                      height={800}
                      {...(isLcp
                        ? { fetchPriority: 'high' }
                        : { loading: 'lazy' })}
                      onError={(e) => {
                        const target = e.currentTarget;
                        const fallback = createSvgPlaceholder(
                          collection.title,
                          collection.slug,
                          1200,
                          800
                        );
                        if (target.src !== fallback) {
                          target.src = fallback;
                        }
                      }}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/95 px-2.5 py-1 text-xs font-semibold text-slate-900 shadow-xs">
                      <Layers
                        className="h-3.5 w-3.5 text-blue-600"
                        aria-hidden="true"
                      />
                      <span>{collection.capture_count} captures</span>
                    </div>
                  </div>

                  {/* Statement & Metadata */}
                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
                      <span>Series 0{index + 1}</span>
                      <span className="font-mono">/{collection.slug}</span>
                    </div>

                    <h2 className="mt-1.5 text-xl font-bold text-slate-900">
                      {collection.title}
                    </h2>

                    {collection.description && (
                      <p className="mt-2 max-w-[65ch] text-sm leading-6 text-slate-600 text-pretty">
                        {collection.description}
                      </p>
                    )}

                    {camerasInSeries.length > 0 && (
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <span className="block text-xs font-medium text-slate-500">
                          Cameras used in series:
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {camerasInSeries.map((cam) => (
                            <span
                              key={cam}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"
                            >
                              <Camera
                                className="h-3 w-3 text-slate-400"
                                aria-hidden="true"
                              />
                              <span>{cam}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="border-t border-slate-200 bg-slate-50/60 px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    onClick={() => onSelectCollection(collection.slug)}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <span>Explore {collection.title.toLowerCase()}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CollectionsView;
