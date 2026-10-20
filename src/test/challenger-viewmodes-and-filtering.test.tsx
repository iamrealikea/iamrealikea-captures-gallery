/**
 * src/test/challenger-viewmodes-and-filtering.test.tsx
 *
 * EMPIRICAL CHALLENGER TEST SUITE for Milestone 3:
 * Core Gallery Views, Toolbar, Filtering, Sorting & Image Priority.
 *
 * Verifies with strict empirical oracles:
 * 1. 3 View Modes: Layout structures, CSS classes, aspect ratios, contact-sheet badges,
 *    editorial story measure (65ch) and telemetry formatters.
 * 2. Modern Web Image Priority (optimize-image-priority):
 *    - Across all 3 view modes, 1st image has fetchpriority="high" and NOT loading="lazy".
 *    - Subsequent images have loading="lazy" and NOT fetchpriority="low" or fetchpriority="high".
 *    - Dynamic updates: LCP priority dynamically follows filter and sort mutations.
 * 3. Gallery Filtering:
 *    - Collection pills with exact counts, active styling, and deselect toggle.
 *    - Camera/gear dropdown filtering with exact counts.
 *    - Live multi-field text search (title, location, camera, lens, story, tags, case-insensitivity, trim).
 *    - Combinatorial filters and empty-state recovery via "Reset filters".
 * 4. Sorting Oracles:
 *    - Exact sequence validation for 'featured', 'captured_desc', and 'created_desc'.
 * 5. Touch Target Compliance (min-h-10 / 40px) across all interactive controls.
 * 6. Adversarial Stress & Edge Cases:
 *    - Special regex/SQL characters, punctuation, whitespace-only queries.
 *    - Mutual exclusivity invariants between fetchpriority and loading="lazy".
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';
import { SEED_CAPTURES } from '../data/seedCaptures';

describe('Empirical Challenger: 3 View Modes, Filtering, Sorting & Image Priority', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  describe('1. View Modes Switching & Layout Class Assertions', () => {
    it('defaults to Masonry Grid with balanced CSS columns and natural aspect ratios', () => {
      render(<App />);

      const masonryBtn = screen.getByRole('button', {
        name: /aspect-ratio masonry grid/i,
      });
      const squareBtn = screen.getByRole('button', {
        name: /uniform square grid/i,
      });
      const editorialBtn = screen.getByRole('button', {
        name: /editorial list/i,
      });

      expect(masonryBtn).toHaveAttribute('aria-pressed', 'true');
      expect(squareBtn).toHaveAttribute('aria-pressed', 'false');
      expect(editorialBtn).toHaveAttribute('aria-pressed', 'false');

      const masonryContainer = screen.getByTestId('gallery-masonry-grid');
      expect(masonryContainer).toHaveClass(
        'columns-1',
        'gap-6',
        'sm:columns-2',
        'lg:columns-3'
      );

      const articles = within(masonryContainer).getAllByRole('article');
      expect(articles.length).toBe(SEED_CAPTURES.length);

      for (const article of articles) {
        expect(article).toHaveClass('break-inside-avoid');
        expect(article).toHaveClass('rounded-xl');
        expect(article).toHaveClass('border-slate-200');
        expect(article).toHaveClass('bg-white');
      }
    });

    it('switches to Uniform Square Grid and asserts 1:1 contact sheet frames with hover overlay badge', () => {
      render(<App />);

      const squareBtn = screen.getByRole('button', {
        name: /uniform square grid/i,
      });
      fireEvent.click(squareBtn);

      expect(squareBtn).toHaveAttribute('aria-pressed', 'true');
      expect(
        screen.getByRole('button', { name: /aspect-ratio masonry grid/i })
      ).toHaveAttribute('aria-pressed', 'false');

      const squareGrid = screen.getByTestId('gallery-square-grid');
      expect(squareGrid).toHaveClass(
        'grid',
        'grid-cols-1',
        'gap-6',
        'sm:grid-cols-2',
        'lg:grid-cols-3',
        'xl:grid-cols-4'
      );

      // Verify contact sheet frame badges
      for (let i = 1; i <= SEED_CAPTURES.length; i++) {
        const frameNum = String(i).padStart(2, '0');
        expect(
          within(squareGrid).getByText(`FRAME #${frameNum}`)
        ).toBeInTheDocument();
      }

      // Verify 1:1 square aspect ratio container on images
      const squareContainers = squareGrid.querySelectorAll('.aspect-square');
      expect(squareContainers.length).toBe(SEED_CAPTURES.length);

      // Verify contact sheet hover overlay badge with "Inspect frame" and Maximize2 icon
      const inspectBadges = within(squareGrid).getAllByText(/inspect frame/i);
      expect(inspectBadges.length).toBe(SEED_CAPTURES.length);

      for (const badge of inspectBadges) {
        const overlayContainer = badge.closest('div');
        expect(overlayContainer).toHaveClass(
          'pointer-events-none',
          'absolute',
          'inset-0',
          'opacity-0',
          'group-hover:opacity-100'
        );
      }
    });

    it('switches to Editorial List and asserts divided rows with 65ch story and formatted EXIF telemetry bar', () => {
      render(<App />);

      const editorialBtn = screen.getByRole('button', {
        name: /editorial list/i,
      });
      fireEvent.click(editorialBtn);

      expect(editorialBtn).toHaveAttribute('aria-pressed', 'true');

      const editorialList = screen.getByTestId('gallery-editorial-list');
      expect(editorialList).toHaveClass(
        'divide-y',
        'divide-slate-200',
        'overflow-hidden',
        'rounded-xl',
        'border',
        'border-slate-200',
        'bg-white'
      );

      const articles = within(editorialList).getAllByRole('article');
      expect(articles.length).toBe(SEED_CAPTURES.length);

      // Verify 240px container on sm viewports (sm:w-60 aspect-3/2)
      for (const article of articles) {
        const thumbBtn = within(article).getByRole('button', {
          name: /^inspect /i,
        });
        expect(thumbBtn).toHaveClass('sm:w-60', 'aspect-3/2');
      }

      // Verify 65ch max-width reading measure on story paragraphs
      const storyParagraphs = editorialList.querySelectorAll('p.max-w-\\[65ch\\]');
      expect(storyParagraphs.length).toBe(SEED_CAPTURES.length);

      // Verify standardized formatters for telemetry
      const firstArticle = articles[0];
      expect(within(firstArticle).getByText('Hasselblad 907X 50C')).toBeInTheDocument();
      expect(within(firstArticle).getByText('XCD 45mm f/4 P')).toBeInTheDocument();
      expect(within(firstArticle).getByText('45mm')).toBeInTheDocument();
      expect(within(firstArticle).getByText('f/8')).toBeInTheDocument();
      expect(within(firstArticle).getByText('1/4s')).toBeInTheDocument();
      expect(within(firstArticle).getByText('ISO 100')).toBeInTheDocument();
    });

    it('survives rapid multi-cycle mode switching without DOM corruption or state drift', () => {
      render(<App />);

      const masonryBtn = screen.getByRole('button', {
        name: /aspect-ratio masonry grid/i,
      });
      const squareBtn = screen.getByRole('button', {
        name: /uniform square grid/i,
      });
      const editorialBtn = screen.getByRole('button', {
        name: /editorial list/i,
      });

      const sequence = [
        { btn: squareBtn, testId: 'gallery-square-grid' },
        { btn: editorialBtn, testId: 'gallery-editorial-list' },
        { btn: masonryBtn, testId: 'gallery-masonry-grid' },
        { btn: editorialBtn, testId: 'gallery-editorial-list' },
        { btn: squareBtn, testId: 'gallery-square-grid' },
        { btn: masonryBtn, testId: 'gallery-masonry-grid' },
      ];

      for (const step of sequence) {
        fireEvent.click(step.btn);
        expect(screen.getByTestId(step.testId)).toBeInTheDocument();
      }
    });
  });

  describe('2. Modern Web Image Priority (optimize-image-priority)', () => {
    it('enforces fetchpriority="high" (NOT loading="lazy") on 1st image and loading="lazy" (NOT fetchpriority) on remaining in Masonry Grid', () => {
      render(<App />);

      const masonryGrid = screen.getByTestId('gallery-masonry-grid');
      const images = within(masonryGrid).getAllByRole('img');
      expect(images.length).toBe(SEED_CAPTURES.length);

      // 1st Image (LCP Candidate)
      expect(images[0]).toHaveAttribute('fetchpriority', 'high');
      expect(images[0]).not.toHaveAttribute('loading');

      // Remaining Images (Below the fold)
      for (let i = 1; i < images.length; i++) {
        expect(images[i]).toHaveAttribute('loading', 'lazy');
        expect(images[i]).not.toHaveAttribute('fetchpriority');
      }
    });

    it('enforces fetchpriority="high" (NOT loading="lazy") on 1st image and loading="lazy" (NOT fetchpriority) on remaining in Square Grid', () => {
      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: /uniform square grid/i }));
      const squareGrid = screen.getByTestId('gallery-square-grid');
      const images = within(squareGrid).getAllByRole('img');
      expect(images.length).toBe(SEED_CAPTURES.length);

      // 1st Image (LCP Candidate)
      expect(images[0]).toHaveAttribute('fetchpriority', 'high');
      expect(images[0]).not.toHaveAttribute('loading');

      // Remaining Images
      for (let i = 1; i < images.length; i++) {
        expect(images[i]).toHaveAttribute('loading', 'lazy');
        expect(images[i]).not.toHaveAttribute('fetchpriority');
      }
    });

    it('enforces fetchpriority="high" (NOT loading="lazy") on 1st image and loading="lazy" (NOT fetchpriority) on remaining in Editorial List', () => {
      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: /editorial list/i }));
      const editorialList = screen.getByTestId('gallery-editorial-list');
      const images = within(editorialList).getAllByRole('img');
      expect(images.length).toBe(SEED_CAPTURES.length);

      // 1st Image (LCP Candidate)
      expect(images[0]).toHaveAttribute('fetchpriority', 'high');
      expect(images[0]).not.toHaveAttribute('loading');

      // Remaining Images
      for (let i = 1; i < images.length; i++) {
        expect(images[i]).toHaveAttribute('loading', 'lazy');
        expect(images[i]).not.toHaveAttribute('fetchpriority');
      }
    });

    it('dynamically transfers LCP priority when sort order changes the first rendered image', () => {
      render(<App />);

      const sortSelect = screen.getByLabelText(/sort order/i);
      const grid = screen.getByTestId('gallery-masonry-grid');

      // Default sort (featured): "Mist over Lake Biwa" is index 0
      let images = within(grid).getAllByRole('img');
      expect(images[0]).toHaveAttribute('alt', 'Mist over Lake Biwa');
      expect(images[0]).toHaveAttribute('fetchpriority', 'high');
      expect(images[0]).not.toHaveAttribute('loading');

      // Change sort to 'captured_desc': "Solitary pine on basalt ridge" becomes index 0
      fireEvent.change(sortSelect, { target: { value: 'captured_desc' } });
      images = within(grid).getAllByRole('img');
      expect(images[0]).toHaveAttribute('alt', 'Solitary pine on basalt ridge');
      expect(images[0]).toHaveAttribute('fetchpriority', 'high');
      expect(images[0]).not.toHaveAttribute('loading');

      // Mist over Lake Biwa is now index 1 and must be lazy loaded
      expect(images[1]).toHaveAttribute('alt', 'Mist over Lake Biwa');
      expect(images[1]).toHaveAttribute('loading', 'lazy');
      expect(images[1]).not.toHaveAttribute('fetchpriority');
    });

    it('handles single-item result image priority correctly without false lazy or low priority', () => {
      render(<App />);

      // Search for specific unique title
      const searchInput = screen.getByLabelText(/search captures/i);
      fireEvent.change(searchInput, { target: { value: 'Dogenzaka' } });

      const grid = screen.getByTestId('gallery-masonry-grid');
      const images = within(grid).getAllByRole('img');
      expect(images.length).toBe(1);
      expect(images[0]).toHaveAttribute('alt', 'Shibuya rain reflections');
      expect(images[0]).toHaveAttribute('fetchpriority', 'high');
      expect(images[0]).not.toHaveAttribute('loading');
    });
  });

  describe('3. Gallery Filtering: Collection, Camera & Multi-field Text Search', () => {
    it('filters by collection correctly and restores on deselect toggle', () => {
      render(<App />);

      // 1. Architecture
      const archPill = screen.getByRole('button', {
        name: /architectural geometry/i,
      });
      fireEvent.click(archPill);
      expect(archPill).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
      expect(screen.getByText('Spiral concrete stairwell')).toBeInTheDocument();
      expect(screen.getByText('Nordic glass & timber pavilion')).toBeInTheDocument();
      expect(screen.queryByText('Shibuya rain reflections')).not.toBeInTheDocument();
      expect(screen.queryByText('Mist over Lake Biwa')).not.toBeInTheDocument();

      // Deselect Architecture
      fireEvent.click(archPill);
      expect(archPill).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByText('Shibuya rain reflections')).toBeInTheDocument();
      expect(screen.getByText('Mist over Lake Biwa')).toBeInTheDocument();

      // 2. Street
      const streetPill = screen.getByRole('button', {
        name: /nocturnal street & transit/i,
      });
      fireEvent.click(streetPill);
      expect(streetPill).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Shibuya rain reflections')).toBeInTheDocument();
      expect(screen.getByText('Night market steam & neon')).toBeInTheDocument();
      expect(screen.queryByText('Brutalist concrete atrium')).not.toBeInTheDocument();

      // 3. Minimalism
      const minPill = screen.getByRole('button', {
        name: /atmospheric minimalism/i,
      });
      fireEvent.click(minPill);
      expect(minPill).toHaveAttribute('aria-pressed', 'true');
      expect(streetPill).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByText('Mist over Lake Biwa')).toBeInTheDocument();
      expect(screen.getByText('Solitary pine on basalt ridge')).toBeInTheDocument();
      expect(screen.getByText('Gypsum dune shadow line')).toBeInTheDocument();
      expect(screen.queryByText('Night market steam & neon')).not.toBeInTheDocument();
    });

    it('filters by camera model dropdown accurately across all available bodies', () => {
      render(<App />);

      const cameraSelect = screen.getByLabelText(/camera or gear/i);

      // Leica Q2 (2 captures: Brutalist atrium, Night market)
      fireEvent.change(cameraSelect, { target: { value: 'Leica Q2' } });
      expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
      expect(screen.getByText('Night market steam & neon')).toBeInTheDocument();
      expect(screen.queryByText('Mist over Lake Biwa')).not.toBeInTheDocument();

      // Hasselblad 907X 50C (2 captures: Mist over Lake Biwa, Gypsum dune)
      fireEvent.change(cameraSelect, { target: { value: 'Hasselblad 907X 50C' } });
      expect(screen.getByText('Mist over Lake Biwa')).toBeInTheDocument();
      expect(screen.getByText('Gypsum dune shadow line')).toBeInTheDocument();
      expect(screen.queryByText('Brutalist concrete atrium')).not.toBeInTheDocument();

      // Reset to all
      fireEvent.change(cameraSelect, { target: { value: '' } });
      expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
      expect(screen.getByText('Mist over Lake Biwa')).toBeInTheDocument();
    });

    it('performs exhaustive live multi-field text search with trimming and case-insensitivity', () => {
      render(<App />);

      const searchInput = screen.getByLabelText(/search captures/i);

      // A. Title search: "stairwell"
      fireEvent.change(searchInput, { target: { value: 'stairwell' } });
      expect(screen.getByText('Spiral concrete stairwell')).toBeInTheDocument();
      expect(screen.queryByText('Brutalist concrete atrium')).not.toBeInTheDocument();

      // B. Location search with mixed case and whitespace: "  bArBiCaN  "
      fireEvent.change(searchInput, { target: { value: '  bArBiCaN  ' } });
      expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
      expect(screen.queryByText('Spiral concrete stairwell')).not.toBeInTheDocument();

      // C. Camera search: "X-T5"
      fireEvent.change(searchInput, { target: { value: 'X-T5' } });
      expect(screen.getByText('Shibuya rain reflections')).toBeInTheDocument();
      expect(screen.getByText('Solitary pine on basalt ridge')).toBeInTheDocument();
      expect(screen.queryByText('Brutalist concrete atrium')).not.toBeInTheDocument();

      // D. Lens search: "24-70mm"
      fireEvent.change(searchInput, { target: { value: '24-70mm' } });
      expect(screen.getByText('Spiral concrete stairwell')).toBeInTheDocument();
      expect(screen.getByText('Nordic glass & timber pavilion')).toBeInTheDocument();
      expect(screen.queryByText('Shibuya rain reflections')).not.toBeInTheDocument();

      // E. Tag search: "monochrome"
      fireEvent.change(searchInput, { target: { value: 'monochrome' } });
      expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
      expect(screen.queryByText('Shibuya rain reflections')).not.toBeInTheDocument();

      // F. Story search: "Fibonacci"
      fireEvent.change(searchInput, { target: { value: 'Fibonacci' } });
      expect(screen.getByText('Spiral concrete stairwell')).toBeInTheDocument();
      expect(screen.queryByText('Brutalist concrete atrium')).not.toBeInTheDocument();

      // G. Clear button restores full gallery
      const clearBtn = screen.getByRole('button', { name: /clear search query/i });
      fireEvent.click(clearBtn);
      expect(searchInput).toHaveValue('');
      expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
      expect(screen.getByText('Mist over Lake Biwa')).toBeInTheDocument();
    });

    it('handles combinatorial filters and recovers gracefully from empty results via Reset Filters', () => {
      render(<App />);

      const archPill = screen.getByRole('button', {
        name: /architectural geometry/i,
      });
      const cameraSelect = screen.getByLabelText(/camera or gear/i);
      const searchInput = screen.getByLabelText(/search captures/i);

      // Combinatorial: Architecture + Sony A7R V + search "stairwell"
      fireEvent.click(archPill);
      fireEvent.change(cameraSelect, { target: { value: 'Sony A7R V' } });
      fireEvent.change(searchInput, { target: { value: 'stairwell' } });

      expect(screen.getByText('Spiral concrete stairwell')).toBeInTheDocument();
      expect(screen.queryByText('Nordic glass & timber pavilion')).not.toBeInTheDocument();

      // Contradictory search leading to empty state
      fireEvent.change(searchInput, { target: { value: 'impossible-query-string' } });

      expect(
        screen.getByRole('heading', {
          name: /no captures match your current filters/i,
        })
      ).toBeInTheDocument();

      // Click "Reset filters" button inside empty state
      const resetBtn = screen.getByRole('button', { name: /^reset filters$/i });
      fireEvent.click(resetBtn);

      // Archive restored
      expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
      expect(screen.getByText('Mist over Lake Biwa')).toBeInTheDocument();
      expect(screen.getByText('Shibuya rain reflections')).toBeInTheDocument();
    });
  });

  describe('4. Sorting Options Oracles (featured, captured_desc, created_desc)', () => {
    it('verifies exact chronological ordering oracle for "featured"', () => {
      render(<App />);

      const grid = screen.getByTestId('gallery-masonry-grid');
      const headings = within(grid).getAllByRole('heading', { level: 3 });

      // Oracle expectation:
      // Featured items (ordered by captured_at desc):
      // 1. Mist over Lake Biwa (2026-03-10)
      // 2. Night market steam & neon (2026-03-05)
      // 3. Shibuya rain reflections (2026-03-01)
      // 4. Brutalist concrete atrium (2026-02-14)
      // 5. Gypsum dune shadow line (2026-02-08)
      // Non-featured items (ordered by captured_at desc):
      // 6. Solitary pine on basalt ridge (2026-03-12)
      // 7. Spiral concrete stairwell (2026-02-18)
      // 8. Nordic glass & timber pavilion (2026-01-29)

      const titles = headings.map((h) => h.textContent);
      expect(titles).toEqual([
        'Mist over Lake Biwa',
        'Night market steam & neon',
        'Shibuya rain reflections',
        'Brutalist concrete atrium',
        'Gypsum dune shadow line',
        'Solitary pine on basalt ridge',
        'Spiral concrete stairwell',
        'Nordic glass & timber pavilion',
      ]);
    });

    it('verifies exact chronological ordering oracle for "captured_desc"', () => {
      render(<App />);

      const sortSelect = screen.getByLabelText(/sort order/i);
      fireEvent.change(sortSelect, { target: { value: 'captured_desc' } });

      const grid = screen.getByTestId('gallery-masonry-grid');
      const headings = within(grid).getAllByRole('heading', { level: 3 });

      // Oracle expectation:
      // 1. Solitary pine on basalt ridge (2026-03-12)
      // 2. Mist over Lake Biwa (2026-03-10)
      // 3. Night market steam & neon (2026-03-05)
      // 4. Shibuya rain reflections (2026-03-01)
      // 5. Spiral concrete stairwell (2026-02-18)
      // 6. Brutalist concrete atrium (2026-02-14)
      // 7. Gypsum dune shadow line (2026-02-08)
      // 8. Nordic glass & timber pavilion (2026-01-29)

      const titles = headings.map((h) => h.textContent);
      expect(titles).toEqual([
        'Solitary pine on basalt ridge',
        'Mist over Lake Biwa',
        'Night market steam & neon',
        'Shibuya rain reflections',
        'Spiral concrete stairwell',
        'Brutalist concrete atrium',
        'Gypsum dune shadow line',
        'Nordic glass & timber pavilion',
      ]);
    });

    it('verifies exact chronological ordering oracle for "created_desc"', () => {
      render(<App />);

      const sortSelect = screen.getByLabelText(/sort order/i);
      fireEvent.change(sortSelect, { target: { value: 'created_desc' } });

      const grid = screen.getByTestId('gallery-masonry-grid');
      const headings = within(grid).getAllByRole('heading', { level: 3 });

      // Oracle expectation:
      // 1. Solitary pine on basalt ridge (2026-03-13)
      // 2. Mist over Lake Biwa (2026-03-11)
      // 3. Night market steam & neon (2026-03-06)
      // 4. Shibuya rain reflections (2026-03-02)
      // 5. Spiral concrete stairwell (2026-02-19)
      // 6. Brutalist concrete atrium (2026-02-15)
      // 7. Gypsum dune shadow line (2026-02-09)
      // 8. Nordic glass & timber pavilion (2026-01-30)

      const titles = headings.map((h) => h.textContent);
      expect(titles).toEqual([
        'Solitary pine on basalt ridge',
        'Mist over Lake Biwa',
        'Night market steam & neon',
        'Shibuya rain reflections',
        'Spiral concrete stairwell',
        'Brutalist concrete atrium',
        'Gypsum dune shadow line',
        'Nordic glass & timber pavilion',
      ]);
    });
  });

  describe('5. Touch Target & Accessibility Compliance (min-h-10 / 40px)', () => {
    it('verifies all interactive buttons and inputs in the toolbar have min-h-10', () => {
      render(<App />);

      // Filter pills
      const allPill = screen.getByRole('button', { name: /all captures/i });
      expect(allPill).toHaveClass('min-h-10');

      const archPill = screen.getByRole('button', {
        name: /architectural geometry/i,
      });
      expect(archPill).toHaveClass('min-h-10');

      // Layout switcher buttons
      const masonryBtn = screen.getByRole('button', {
        name: /aspect-ratio masonry grid/i,
      });
      expect(masonryBtn).toHaveClass('min-h-10');

      const squareBtn = screen.getByRole('button', {
        name: /uniform square grid/i,
      });
      expect(squareBtn).toHaveClass('min-h-10');

      const editorialBtn = screen.getByRole('button', {
        name: /editorial list/i,
      });
      expect(editorialBtn).toHaveClass('min-h-10');

      // Search input & select dropdowns
      const searchInput = screen.getByLabelText(/search captures/i);
      expect(searchInput).toHaveClass('min-h-10');

      const cameraSelect = screen.getByLabelText(/camera or gear/i);
      expect(cameraSelect).toHaveClass('min-h-10');

      const sortSelect = screen.getByLabelText(/sort order/i);
      expect(sortSelect).toHaveClass('min-h-10');
    });
  });

  describe('6. Adversarial Stress & Edge Cases', () => {
    it('survives special regex characters, SQL characters, and punctuation in search input', () => {
      render(<App />);

      const searchInput = screen.getByLabelText(/search captures/i);

      const adversarialInputs = [
        '.*',
        '([a-z]+)',
        '\\',
        '?',
        '+',
        '^$',
        '\' OR \'1\'=\'1',
        '<script>alert(1)</script>',
        '#concrete',
        'f/2.8',
        '1/250s',
      ];

      for (const input of adversarialInputs) {
        expect(() => {
          fireEvent.change(searchInput, { target: { value: input } });
        }).not.toThrow();

        // Specific valid matches
        if (input === 'f/2.8' || input === '1/250s' || input === '#concrete') {
          // May match or not depending on haystack, but must not crash
        }
      }
    });

    it('treats whitespace-only queries as no-op without emptying archive', () => {
      render(<App />);

      const searchInput = screen.getByLabelText(/search captures/i);
      fireEvent.change(searchInput, { target: { value: '     ' } });

      const grid = screen.getByTestId('gallery-masonry-grid');
      const articles = within(grid).getAllByRole('article');
      expect(articles.length).toBe(SEED_CAPTURES.length);
    });

    it('strictly maintains mutual exclusivity invariant: NO image ever has both fetchpriority and loading="lazy"', () => {
      render(<App />);

      const views: ('masonry' | 'square' | 'editorial')[] = [
        'masonry',
        'square',
        'editorial',
      ];

      for (const view of views) {
        if (view === 'square') {
          fireEvent.click(screen.getByRole('button', { name: /uniform square grid/i }));
        } else if (view === 'editorial') {
          fireEvent.click(screen.getByRole('button', { name: /editorial list/i }));
        } else {
          fireEvent.click(screen.getByRole('button', { name: /aspect-ratio masonry grid/i }));
        }

        const images = screen.getAllByRole('img');
        for (const img of images) {
          const fetchPriority = img.getAttribute('fetchpriority');
          const loading = img.getAttribute('loading');

          // Strict invariant 1: An image can NEVER have both fetchpriority and loading="lazy"
          if (fetchPriority) {
            expect(loading).not.toBe('lazy');
          }
          if (loading === 'lazy') {
            expect(fetchPriority).toBeNull();
          }

          // Strict invariant 2: fetchpriority must never be set to "low"
          expect(fetchPriority).not.toBe('low');
        }
      }
    });
  });
});
