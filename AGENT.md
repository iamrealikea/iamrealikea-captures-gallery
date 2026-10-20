# AGENTS.md — captures-gallery

Project guidelines and architectural instructions for the modern contemporary **Personal Gallery (`captures-gallery`)** application.

---

## 1. Project Overview & Vision

`captures-gallery` is a modern, high-performance personal photography and visual captures showcase. It combines a refined, gallery-grade visual presentation with an accessible, resilient architecture powered by:
- **Frontend**: Vite + React 19 + TypeScript + Tailwind CSS v4.
- **Backend & Cloudflare Platform**: Cloudflare Workers, Cloudflare D1 (SQLite database), Cloudflare R2 (Object storage), and Cloudflare Access (Zero Trust) JWT authentication.
- **Ingestion**: Dual workflow supporting both a local folder sync CLI (`npm run sync` scanning `./captures/`) and a browser-based Admin Curation Studio (`/admin`).

---

## 2. Design System & Visual Restraint (`DESIGN_SYSTEM.md`)

All screens, layouts, and components must strictly adhere to the guidelines established in [`DESIGN_SYSTEM.md`](file:///C:/Users/siraw/captures-gallery/DESIGN_SYSTEM.md):

### Foundations
- **Color Palette**:
  - Application background & surface: `#FFFFFF` (`--color-background`, `--color-surface`)
  - Subtle sections / hover backgrounds: `#F8FAFC` (`--color-surface-subtle`)
  - Borders & dividers: `#E2E8F0` (`--color-border`)
  - Primary text: `#0F172A` (`--color-text`)
  - Muted text & icons: `#64748B` (`--color-text-muted`)
  - Single primary blue accent: `#2563EB` (`--color-primary`), hover `#1D4ED8`, subtle background `#EFF6FF`
  - Semantic status tokens: Success `#16A34A`, Warning `#D97706`, Danger `#DC2626`
  - *Rule*: Never use color alone to communicate state. Pair status colors with clear copy and an icon.
- **Typography**:
  - Font stack: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  - Scale: Display (`36px/44px`, 700), H1 (`30px/36px`, 700), H2 (`24px/32px`, 700), H3 (`20px/28px`, 600), Body (`16px/24px`, 400), Body small (`14px/20px`, 400), Label (`14px/20px`, 500–600), Caption (`12px/16px`, 500).
  - Sentence case across all headings, buttons, labels, and navigation.
  - Limit paragraph measure to approximately `65ch` for reading comfort.
- **Spacing & Layout**:
  - 4-pixel base unit (`space-1` = 4px, `space-2` = 8px, `space-4` = 16px, `space-6` = 24px, `space-8` = 32px, `space-12` = 48px).
  - Centered container: `mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8`.
  - Vertical page padding: `py-8 sm:py-12 lg:py-16`.
  - Use `gap` for layout relationships rather than child margins.
- **Elevation & Controls**:
  - Standard cards and interactive controls: `rounded-lg` (`8px`).
  - Prominent cards and modal dialogs: `rounded-xl` (`12px`).
  - Dividers: `border border-slate-200`.
  - Accessible hit target: Minimum height of `40px` (`min-h-10`) for all buttons, inputs, and clickable controls.
  - Visible focus state: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600`.
  - Shadows: Subdued and restrained (`shadow-sm` for cards, `shadow-lg` for dialogs). Avoid large shadows or multi-color gradients.

---

## 3. Cloudflare Architecture & Tooling

When interacting with Cloudflare:
- **Cloudflare Interaction Rule**: When interacting with Cloudflare, use the `cf` CLI unless the project has a Wrangler configuration file. In this project (which uses `wrangler.jsonc`), use **Wrangler** for local development, migrations, and deployments.
- **Bindings**:
  - `DB`: Cloudflare D1 database (`captures-gallery-db`) storing collections, capture metadata, EXIF parameters, and gear tags.
  - `BUCKET`: Cloudflare R2 bucket (`captures-gallery-media`) storing original captures and WebP variants.
- **Authentication**:
  - In production: Verify Cloudflare Access Zero Trust JWTs via `Cf-Access-Jwt-Assertion` header against `https://<CF_ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs` using Web Crypto RS256.
  - In local development: Automatically bypass verification with `{ authenticated: true, email: 'dev@localhost', mode: 'development-bypass' }`.
- **Local Dev Resilience**:
  - Provide local SQLite and in-memory mock bindings so `npm run dev` and `npm test` operate completely offline without requiring pre-existing Cloudflare cloud resources.

---

## 4. Key Functional Areas

### 4.1. Navigation & Views
1. **Top Navigation**: Concise 4-item navigation (`Gallery`, `Collections`, `About & gear`, `Admin studio`).
2. **Gallery Toolbar**:
   - Collection filter pills (`All captures`, `Architecture`, `Street`, `Minimalism`, etc.) with counts.
   - Text search (`min-h-10 rounded-lg border border-slate-300`) matching title, location, camera, or tags.
   - Sort dropdown (`Featured first`, `Capture date (newest)`, `Newly added`).
   - Camera/Gear filter dropdown.
   - **3-Mode View Switcher**:
     - **Aspect-ratio Masonry Grid**: Preserves natural portrait/landscape ratios with balanced CSS columns.
     - **Uniform Square Grid**: Contact-sheet square frames (`aspect-square`).
     - **Editorial List**: Horizontal rows with photo thumbnail, story excerpt (`65ch`), and complete EXIF summary.
3. **Photo Lightbox Dialog**:
   - Synced with URL search param `?photo=<slug>`.
   - Native `<dialog closedby="any">` opened via `showModal()`.
   - High-resolution image preview with story, collection, date, and location.
   - Detailed EXIF Telemetry panel: Camera body, lens, focal length, aperture (`f/`), shutter speed (`s`), ISO, and resolution.
   - Keyboard navigation (`←`, `→`, `Esc`) and "Copy share link" action.
4. **Collections View**:
   - Cards displaying curated photo series, statements, capture counts, and gear summaries. Clicking a collection filters the gallery.
5. **About & Gear View**:
   - Photographer statement, bio, and interactive **Gear & Optics Inventory** linking directly to filtered captures shot with each piece of gear.
6. **Admin Curation Studio (`/admin`)**:
   - Cloudflare Access Zero Trust status badge.
   - Drag-and-drop image upload with automatic client-side EXIF extraction via `exifr`.
   - Metadata curation (title, story, collection, location, tags, featured toggle).
   - Capture management table with editing and confirmation-backed deletion.

### 4.2. Local Folder Sync CLI
- CLI script at `scripts/sync-captures.ts` (`npm run sync`).
- Scans `captures/<collection-slug>/` for images, extracts EXIF data, and syncs to R2 & D1.

---

## 5. Modern Web Guidance Rules

Always adhere to modern web platform best practices:
1. **Image Priority (`optimize-image-priority`)**:
   - Apply `fetchpriority="high"` strictly to the Largest Contentful Paint (LCP) image.
   - Do NOT combine `fetchpriority="high"` with `loading="lazy"`.
   - Standard below-the-fold images use `loading="lazy"` alone (do NOT add `fetchpriority="low"` to lazy images).
2. **Accessible Light-Dismiss Dialog (`light-dismiss-a-dialog`)**:
   - Add `closedby="any"` to the `<dialog>` and open with `showModal()`.
   - For Safari/browsers lacking native `closedby`, implement the coordinate-boundary click listener fallback on `dialog::backdrop`.
3. **Smooth State Transitions (`same-document-transitions`)**:
   - Wrap view transitions in `document.startViewTransition()` if supported.
   - Programmatically shift focus (`tabindex="-1"`) to the new container or heading after transition to preserve screen-reader context.
   - Respect `@media (prefers-reduced-motion: reduce)`.
4. **Typographic Legibility (`improve-text-layout-and-legibility`)**:
   - Apply `text-wrap: balance` to short headings (`h1`–`h6`).
   - Apply `text-wrap: pretty` to multi-line body paragraphs and photo stories to eliminate orphaned words.

---

## 6. Development & Operational Commands

```bash
# Start local development server with Vite + Cloudflare bindings
npm run dev

# Run unit and integration tests
npm test

# Build production bundle and type-check
npm run build

# Run local captures folder sync CLI
npm run sync

# Apply local D1 SQLite migrations
npx wrangler d1 migrations apply DB --local

# Deploy to Cloudflare Workers
npm run cf:deploy
```
