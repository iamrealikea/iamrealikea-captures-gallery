# TEST_READY: captures-gallery Test Manifest & Verification Report

**Project**: `captures-gallery` (Personal Photography Showcase & Curation Studio)  
**Status**: Ready for Audit / All Tests Passing  
**Timestamp**: 2026-10-20T07:35:00Z  
**Test Runner**: Vitest v3.2.7 (`npm test`)  
**Pass Rate**: **100% (233 / 233 tests passing across 12 test suites)**  

---

## 1. Executive Summary & Verification Gates

All automated verification gates have executed with zero errors and zero warnings:

| Verification Gate | Command | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| **Type Check** | `npx tsc --noEmit` | Exit code 0, 0 type errors | Exit code 0, 0 type errors | **PASS** |
| **Production Build** | `npm run build` | Exit code 0, clean Vite bundle | Exit code 0, 1953 modules transformed in 2.94s | **PASS** |
| **Automated Test Suites** | `npm test` | Exit code 0, 100% test pass rate | Exit code 0, 12 files passed, 233 tests passed | **PASS** |
| **Ingestion CLI Dry Run** | `npm run sync -- --dry-run` | Exit code 0, scans `./captures/` | Exit code 0, 6 captures validated with full EXIF | **PASS** |

---

## 2. Test Suite Tier Breakdown

The test suite is structured into four comprehensive testing tiers covering foundational unit behavior, edge boundaries, cross-feature state interactions, and realistic ingestion pipelines.

### Tier 1: Feature Coverage (Core Functional Capabilities)
- **Gallery Toolbar, Filtering & Search** (`src/test/gallery.test.tsx`):
  - 4 top-level navigation items rendering and gallery default state.
  - Collection filter pills with item counts and active state toggling.
  - Multi-field text search matching title, location, camera model, lens, and tags.
  - Sort selection: `Featured first`, `Capture date (newest)`, `Newly added`.
  - Camera gear dropdown filter isolating captures shot with specific camera models.
- **View Modes & Image Priority** (`src/test/viewModes.test.tsx`):
  - **Aspect-ratio Masonry Grid**: CSS column layout preserving natural photo proportions.
  - **Uniform Square Grid**: 1:1 contact sheet frames with hover overlay badges.
  - **Editorial List**: Divided horizontal cards with 65ch story excerpts and complete EXIF summary bars.
  - **Modern Web LCP Priority**: Enforces `fetchpriority="high"` strictly on the first image without `loading="lazy"`, and `loading="lazy"` on subsequent images without `fetchpriority="low"`.
- **Photo Lightbox Dialog** (`src/test/lightbox.test.tsx`):
  - Native `<dialog closedby="any">` opened via `showModal()`.
  - URL parameter synchronization (`?photo=<slug>`) on open and close.
  - Cross-browser coordinate-boundary click listener fallback on `dialog::backdrop`.
  - Keyboard navigation: `ArrowRight` (next), `ArrowLeft` (previous), `Escape` (dismiss).
  - Copy share link action writing canonical permalink to clipboard with visual feedback.
  - Structured technical EXIF drawer displaying camera body, lens, focal length, aperture (`f/`), shutter speed (`s`), ISO, and capture date.
- **Top Navigation, Cross-Filtering & Routing** (`src/test/navigation.test.tsx`):
  - Navbar destination switching between Gallery, Collections, About & Gear, and Admin Studio.
  - Cross-filtering: Clicking a collection card navigates to Gallery filtered by that collection.
  - Cross-filtering: Clicking a gear item navigates to Gallery filtered by that camera model.
  - Modern Web View Transitions: `document.startViewTransition()` with programmatic focus routing (`tabindex="-1"`) to target headings.
- **Admin Curation Studio** (`src/test/adminStudio.test.tsx`):
  - Cloudflare Access Zero Trust status badge.
  - Drag-and-drop image dropzone with 25MB constraint and MIME validation.
  - Client-side EXIF auto-extraction via `exifr` pre-populating camera, lens, exposure, and dimensions.
  - Capture curation form lifecycle: creation, validation alerts on empty title, metadata editing.
  - Inline featured status toggling.
  - Accessible confirmation-backed deletion modal preventing accidental record removal.
- **Cloudflare Worker API & Sync CLI** (`src/test/worker-and-sync.test.ts`):
  - REST endpoints: `GET /api/captures`, `GET /api/captures/:id`, `GET /api/collections`, `GET /api/auth/session`, `POST /api/admin/captures`, `PUT /api/admin/captures/:id`, `DELETE /api/admin/captures/:id`, `POST /api/admin/sync`.
  - Cloudflare Access Zero Trust JWT verification (RS256 Web Crypto) and local dev bypass (`dev@localhost`).
  - Offline emulation resilience using pre-seeded editorial photography in `src/data/seedCaptures.ts`.

### Tier 2: Boundary & Corner Cases
- **Type Invariants & Nullability** (`src/test/types-adversarial.test.ts`):
  - Robust handling of missing EXIF fields (e.g. legacy/manual lenses without aperture or focal length).
  - Extreme aspect ratios (ultra-wide panoramas 3:1, vertical architectural captures 1:3).
  - Fallback slug generation from title and timestamp when filename lacks semantic information.
  - Validation of non-ASCII characters, symbols, and whitespace in search queries and tag arrays.
- **Storage, Keys & Ingestion Boundaries** (`src/test/challenger-sync-and-storage.test.ts`):
  - Enforces canonical R2 key layout: `captures/<collection-slug>/<filename>`.
  - Sync CLI `--dry-run` safety invariant: verifies 0 state mutations occur in D1 or R2 during dry runs.
  - Resilient handling of empty directories, non-image files, and corrupted headers during folder scanning.
- **File Upload Limits & MIME Constraints** (`src/test/challenger-admin-curation-studio.test.tsx`):
  - Exact 25MB boundary threshold testing (25MB accepted, 25MB + 1 byte rejected).
  - Explicit rejection of unsupported MIME types (`image/gif`, `image/svg+xml`, `application/pdf`, `text/plain`).
  - Whitespace-only title submissions trigger validation warnings and block submission.

### Tier 3: Cross-Feature & State Invariants (Challenger Suites)
- **View Mode Switching & State Drift** (`src/test/challenger-viewmodes-and-filtering.test.tsx`):
  - 20-cycle rapid view mode switching without DOM corruption, layout shifts, or lost filter state.
  - Multi-filter intersection: simultaneous collection filter + camera filter + text search + sort order.
  - Strict Modern Web invariant: across all view modes and re-renders, **NO image ever possesses both `fetchpriority` and `loading="lazy"`**.
- **Lightbox Adversarial Stress** (`src/test/challenger-lightbox-adversarial.test.tsx`):
  - Opening lightbox from any view mode (Masonry, Square, Editorial) correctly updates URL and state.
  - Browser history popstate back/forward transitions cleanly open/close the lightbox.
  - Rapid keypress navigation (`ArrowRight` / `ArrowLeft` stress) wraps boundaries seamlessly without crashing.
  - Clipboard API failure fallback gracefully handled when clipboard permissions are denied.
- **Navigation Stress & Focus Management** (`src/test/challenger-navigation-adversarial.test.tsx`):
  - 20 rapid cyclical view switches between the 4 main views without race conditions or orphaned views.
  - Programmatic focus transfer to target headings (`tabindex="-1"`) to maintain screen-reader context.
  - Respects `prefers-reduced-motion` media queries during view transitions.
  - Cross-filtering from Collections and Gear views properly clears stale filters and updates UI pills.

### Tier 4: Real-World Ingestion & Operational Pipeline
- **Folder Sync CLI Execution** (`scripts/sync-captures.ts`):
  - Direct local folder traversal of `./captures/architecture/`, `./captures/minimalism/`, and `./captures/street/`.
  - Authentic EXIF metadata extraction via `exifr` parsing camera body, lens, exposure, and dimensions.
  - Formatted terminal telemetry output and dry-run confirmation.

---

## 3. Test Suites and Results Summary

| Suite / Test File | Tests | Duration | Coverage Focus |
|---|:---:|:---:|---|
| `src/test/types-adversarial.test.ts` | 42 | 49ms | Data models, EXIF edge cases, nullability, slug fallbacks |
| `src/test/challenger-sync-and-storage.test.ts` | 25 | 243ms | R2 key hierarchy, D1 schema invariants, sync dry-run safety |
| `src/test/worker-and-sync.test.ts` | 11 | 353ms | Edge API endpoints, Zero Trust JWT validation & dev bypass |
| `src/test/viewModes.test.tsx` | 5 | 1618ms | Masonry, Square, Editorial layouts, LCP priority enforcement |
| `src/test/lightbox.test.tsx` | 12 | 2309ms | Native dialog, URL sync, backdrop fallback, keyboard, EXIF |
| `src/test/navigation.test.tsx` | 10 | 3060ms | Top navbar, view switching, cross-filtering, focus management |
| `src/test/adminStudio.test.tsx` | 7 | 3382ms | Dropzone, exifr auto-extraction, CRUD lifecycle, deletion modal |
| `src/test/challenger-lightbox-adversarial.test.tsx` | 36 | 3633ms | Deep-link routing, history popstate, rapid cycling, boundary wrap |
| `src/test/gallery.test.tsx` | 10 | 3838ms | Toolbar filtering, multi-field search, sort options, integration |
| `src/test/challenger-viewmodes-and-filtering.test.tsx` | 20 | 4999ms | Multi-cycle mode switching, filter intersections, LCP mutual exclusivity |
| `src/test/challenger-admin-curation-studio.test.tsx` | 22 | 6951ms | File boundary limits, MIME rejection, form validation, edit/delete |
| `src/test/challenger-navigation-adversarial.test.tsx` | 33 | 7364ms | Rapid navigation stress, focus routing, cross-filtering state reset |
| **Total** | **233** | **12.51s** | **100% Pass Rate** |

---

## 4. How to Execute Tests

To re-run the full verification suite independently:

```bash
# 1. Run all automated unit and integration tests (non-interactive)
npm test

# 2. Run TypeScript type checking
npx tsc --noEmit

# 3. Compile production bundle
npm run build

# 4. Verify Local Folder Sync CLI
npm run sync -- --dry-run
```
