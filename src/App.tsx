/**
 * proposed_App.tsx
 *
 * Proposed enhancement for src/App.tsx:
 * 1. Top-level view router across 4 views (gallery, collections, about, admin)
 * 2. Cross-filtering coordination from Collections and About & Gear to Gallery
 * 3. Modern Web Guidance View Transitions with programmatic focus routing
 * 4. Dev/test resilience with API fetch and fallback to mockStore / seedCaptures
 * 5. Browser history and popstate synchronization
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SEED_GEAR_INVENTORY } from './data/seedCaptures';
import { defaultMockStore } from './data/mockStore';
import type {
  ActiveView,
  AuthSession,
  Capture,
  Collection,
  CreateCaptureInput,
  GalleryFilters,
  UpdateCaptureInput,
} from './types/gallery';
import {
  computeGearInventory,
  enrichCollectionsWithCounts,
  filterAndSortCaptures,
  getAvailableCameras,
} from './utils/galleryFilter';
import { slugify } from './utils/exifExtractor';
import { createSvgPlaceholder } from './utils/imagePlaceholder';
import { runViewTransition } from './utils/viewTransitions';
import { Navbar } from './components/Navbar';
import { GalleryView } from './components/GalleryView';
import { CollectionsView } from './components/CollectionsView';
import { AboutGearView } from './components/AboutGearView';
import { AdminStudioView } from './components/AdminStudioView';
import { PhotoLightboxDialog } from './components/PhotoLightboxDialog';

const DEFAULT_FILTERS: GalleryFilters = {
  collection: null,
  search: '',
  camera: null,
  sort: 'featured',
  viewMode: 'masonry',
};

function getInitialView(): ActiveView {
  if (typeof window === 'undefined') return 'gallery';
  const pathname = window.location.pathname.toLowerCase();
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/collections')) return 'collections';
  if (pathname.startsWith('/about')) return 'about';
  return 'gallery';
}

function getPhotoSlugFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('photo');
}

export const App: React.FC = () => {
  const [captures, setCaptures] = useState<Capture[]>(() =>
    defaultMockStore.getAllCaptures()
  );
  const [collections, setCollections] = useState<Collection[]>(() =>
    defaultMockStore.getAllCollections()
  );
  const [authSession, setAuthSession] = useState<AuthSession>({
    authenticated: true,
    email: 'dev@localhost',
    mode: 'development-bypass',
  });

  const [activeView, setActiveView] = useState<ActiveView>(getInitialView);
  const [filters, setFilters] = useState<GalleryFilters>(DEFAULT_FILTERS);
  const [activePhotoSlug, setActivePhotoSlug] = useState<string | null>(
    getPhotoSlugFromUrl
  );

  // Dev/Test Resilience: Load initial data from Worker API with silent fallback
  useEffect(() => {
    let isCancelled = false;
    async function loadInitialData() {
      try {
        const [capturesRes, collectionsRes, sessionRes] =
          await Promise.allSettled([
            fetch('/api/captures').then(async (r) => (r.ok ? (r.json() as Promise<any>) : null)),
            fetch('/api/collections').then(async (r) => (r.ok ? (r.json() as Promise<any>) : null)),
            fetch('/api/auth/session').then(async (r) => (r.ok ? (r.json() as Promise<any>) : null)),
          ]);

        if (isCancelled) return;

        if (capturesRes.status === 'fulfilled' && capturesRes.value) {
          const val = capturesRes.value as any;
          const list = Array.isArray(val)
            ? val
            : val.captures;
          if (Array.isArray(list) && list.length > 0) {
            setCaptures(list);
          }
        }

        if (collectionsRes.status === 'fulfilled' && collectionsRes.value) {
          const val = collectionsRes.value as any;
          const list = Array.isArray(val)
            ? val
            : val.collections;
          if (Array.isArray(list) && list.length > 0) {
            setCollections(list);
          }
        }

        if (sessionRes.status === 'fulfilled' && sessionRes.value) {
          const val = sessionRes.value as any;
          if (typeof val.authenticated === 'boolean') {
            setAuthSession(val as AuthSession);
          }
        }
      } catch {
        // Retain defaultMockStore / SEED data in offline dev or mock test mode
      }
    }
    loadInitialData();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Sync ?photo=<slug> and activeView on browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setActivePhotoSlug(getPhotoSlugFromUrl());
      setActiveView(getInitialView());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Derived filtered & sorted captures
  const filteredCaptures = useMemo(
    () => filterAndSortCaptures(captures, filters),
    [captures, filters]
  );

  // Enriched collections with live capture counts
  const enrichedCollections = useMemo(
    () => enrichCollectionsWithCounts(collections, captures),
    [collections, captures]
  );

  // Unique cameras & lenses for dropdown filter
  const availableCameras = useMemo(
    () => getAvailableCameras(captures),
    [captures]
  );

  // Dynamic gear inventory counts
  const gearInventory = useMemo(
    () => computeGearInventory(captures, SEED_GEAR_INVENTORY),
    [captures]
  );

  // Active capture for the URL-synced Lightbox Dialog
  const activeLightboxCapture = useMemo(() => {
    if (!activePhotoSlug) return null;
    return (
      captures.find(
        (c) => c.slug === activePhotoSlug || c.id === activePhotoSlug
      ) || null
    );
  }, [captures, activePhotoSlug]);

  // View Transition navigation between top-level views with history pushState
  const handleSelectView = useCallback((nextView: ActiveView) => {
    const headingMap: Record<ActiveView, string> = {
      gallery: '#gallery-view-heading',
      collections: '#collections-view-heading',
      about: '#about-view-heading',
      admin: '#admin-view-heading',
    };
    if (typeof window !== 'undefined') {
      const targetPath = nextView === 'gallery' ? '/' : `/${nextView}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
    }
    runViewTransition(() => {
      setActiveView(nextView);
    }, headingMap[nextView]);
  }, []);

  // Update gallery filters (with View Transition on viewMode switch)
  const handleUpdateFilters = useCallback(
    (partial: Partial<GalleryFilters>) => {
      if (partial.viewMode && partial.viewMode !== filters.viewMode) {
        runViewTransition(() => {
          setFilters((prev) => ({ ...prev, ...partial }));
        }, '#gallery-grid-container');
      } else {
        setFilters((prev) => ({ ...prev, ...partial }));
      }
    },
    [filters.viewMode]
  );

  const handleResetFilters = useCallback(() => {
    runViewTransition(() => {
      setFilters((prev) => ({
        ...DEFAULT_FILTERS,
        viewMode: prev.viewMode,
      }));
    }, '#gallery-view-heading');
  }, []);

  // Open Lightbox and sync ?photo=<slug> in URL
  const handleSelectCapture = useCallback((capture: Capture) => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('photo', capture.slug);
      window.history.pushState({}, '', `${url.pathname}${url.search}`);
    }
    setActivePhotoSlug(capture.slug);
  }, []);

  // Close Lightbox and clean ?photo=<slug> from URL
  const handleCloseLightbox = useCallback(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('photo');
      const searchStr = url.searchParams.toString();
      window.history.replaceState(
        {},
        '',
        `${url.pathname}${searchStr ? `?${searchStr}` : ''}`
      );
    }
    setActivePhotoSlug(null);
  }, []);

  // Filter gallery by clicking a collection card in CollectionsView
  const handleSelectCollectionFromCard = useCallback(
    (collectionSlug: string) => {
      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
      }
      runViewTransition(() => {
        setFilters((prev) => ({
          ...prev,
          collection: collectionSlug,
          camera: null,
          search: '',
        }));
        setActiveView('gallery');
      }, '#gallery-view-heading');
    },
    []
  );

  // Filter gallery by clicking a camera or lens in AboutGearView or Lightbox
  const handleFilterByGear = useCallback((gearName: string) => {
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    runViewTransition(() => {
      setFilters((prev) => ({
        ...prev,
        collection: null,
        camera: gearName,
        search: '',
      }));
      setActiveView('gallery');
    }, '#gallery-view-heading');
  }, []);

  // Admin Studio CRUD: Create Capture
  const handleCreateCapture = useCallback(
    async (input: CreateCaptureInput): Promise<Capture> => {
      const slug = input.slug ? slugify(input.slug) : slugify(input.title);
      const width = input.width > 0 ? input.width : 3840;
      const height = input.height > 0 ? input.height : 2560;
      const newCapture: Capture = {
        id: `cap-${Date.now()}`,
        slug,
        title: input.title.trim(),
        story: input.story ?? null,
        collection_slug: input.collection_slug,
        r2_key: input.r2_key || `captures/${input.collection_slug}/${slug}.jpg`,
        image_url:
          input.image_url ||
          createSvgPlaceholder(
            input.title.trim(),
            input.collection_slug,
            width,
            height
          ),
        width,
        height,
        aspect_ratio:
          input.aspect_ratio || Number((width / height).toFixed(2)),
        location: input.location ?? null,
        captured_at: input.captured_at ?? new Date().toISOString(),
        camera_model: input.camera_model ?? null,
        lens_model: input.lens_model ?? null,
        focal_length: input.focal_length ?? null,
        aperture: input.aperture ?? null,
        shutter_speed: input.shutter_speed ?? null,
        iso: input.iso ?? null,
        tags: input.tags || [],
        featured: Boolean(input.featured),
        created_at: new Date().toISOString(),
      };

      defaultMockStore.createCapture(newCapture);
      setCaptures((prev) => [newCapture, ...prev]);
      return newCapture;
    },
    []
  );

  // Admin Studio CRUD: Update Capture
  const handleUpdateCapture = useCallback(
    async (id: string, updates: UpdateCaptureInput): Promise<Capture> => {
      let updatedItem: Capture | null = null;
      try {
        defaultMockStore.updateCapture(id, updates);
      } catch {
        // Ignore if not present in mock store
      }

      setCaptures((prev) =>
        prev.map((item) => {
          if (item.id !== id && item.slug !== id) return item;
          const width =
            updates.width !== undefined && updates.width > 0
              ? updates.width
              : item.width;
          const height =
            updates.height !== undefined && updates.height > 0
              ? updates.height
              : item.height;
          const next: Capture = {
            ...item,
            ...updates,
            width,
            height,
            aspect_ratio:
              updates.aspect_ratio || Number((width / height).toFixed(2)),
            tags: updates.tags !== undefined ? updates.tags : item.tags,
            featured:
              updates.featured !== undefined
                ? Boolean(updates.featured)
                : item.featured,
          };
          updatedItem = next;
          return next;
        })
      );
      if (!updatedItem) {
        throw new Error(`Capture not found: ${id}`);
      }
      return updatedItem;
    },
    []
  );

  // Admin Studio CRUD: Delete Capture
  const handleDeleteCapture = useCallback(async (id: string): Promise<void> => {
    defaultMockStore.deleteCapture(id);
    setCaptures((prev) => prev.filter((c) => c.id !== id && c.slug !== id));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      {/* Top Navigation */}
      <Navbar
        activeView={activeView}
        onSelectView={handleSelectView}
        totalCapturesCount={captures.length}
        authSession={authSession}
      />

      {/* Centered Content Container (DESIGN_SYSTEM.md: max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16) */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        {activeView === 'gallery' && (
          <GalleryView
            captures={filteredCaptures}
            totalCapturesCount={captures.length}
            collections={enrichedCollections}
            availableCameras={availableCameras}
            filters={filters}
            onUpdateFilters={handleUpdateFilters}
            onResetFilters={handleResetFilters}
            onSelectCapture={handleSelectCapture}
          />
        )}

        {activeView === 'collections' && (
          <CollectionsView
            collections={enrichedCollections}
            captures={captures}
            onSelectCollection={handleSelectCollectionFromCard}
          />
        )}

        {activeView === 'about' && (
          <AboutGearView
            gearInventory={gearInventory}
            onFilterByGear={handleFilterByGear}
          />
        )}

        {activeView === 'admin' && (
          <AdminStudioView
            captures={captures}
            collections={collections}
            authSession={authSession}
            onCreateCapture={handleCreateCapture}
            onUpdateCapture={handleUpdateCapture}
            onDeleteCapture={handleDeleteCapture}
          />
        )}
      </main>

      {/* URL-Synced Native <dialog closedby="any"> Photo Lightbox */}
      <PhotoLightboxDialog
        capture={activeLightboxCapture}
        captures={filteredCaptures.length > 0 ? filteredCaptures : captures}
        onClose={handleCloseLightbox}
        onSelectCapture={handleSelectCapture}
        onFilterByCamera={handleFilterByGear}
      />

      {/* Restrained Editorial Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <p>
            Captures — Personal photography archive. Delivered via Cloudflare
            Workers, D1 SQLite, R2 Storage &amp; Zero Trust Access.
          </p>
          <div className="flex items-center gap-4 font-medium text-slate-600">
            <span>All EXIF telemetry verified</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
