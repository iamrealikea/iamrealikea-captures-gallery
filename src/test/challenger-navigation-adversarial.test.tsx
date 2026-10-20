/**
 * src/test/challenger-navigation-adversarial.test.tsx
 *
 * EMPIRICAL CHALLENGER TEST SUITE for Milestone 4:
 * Navigation, View Transitions, Cross-Filtering & History Synchronization.
 *
 * Stress-tests and empirically verifies:
 * 1. Top-Level Navigation Matrix across all 4 views (Gallery, Collections, About & Gear, Admin)
 *    - Active nav pill styling, aria-current="page", text colors, borders
 *    - Strict mutual exclusivity of active nav indicator
 *    - Distinct view headings rendered with tabindex="-1"
 *    - Inactive views completely unmounted from DOM
 *    - Touch target compliance (min-h-10) and visible focus rings
 * 2. Cross-Filtering from Collections View:
 *    - Clicking collection explore button navigates to Gallery
 *    - Sets filters.collection and clears search/camera filters
 *    - URL history pushState to '/'
 *    - Renders filtered captures for all seed collections
 *    - Toggling active collection pill in Gallery resets to all captures
 * 3. Cross-Filtering from About & Gear View:
 *    - Clicking camera body navigates to Gallery and filters by camera model
 *    - Clicking reference lens navigates to Gallery and filters by lens model
 *    - Verifies fallback <option> in GalleryToolbar select when lens is not in camera list
 *    - Resets collection and search query
 * 4. Browser History Synchronization & Deep Linking:
 *    - Initial view detection from window.location.pathname ('/collections', '/about', '/admin', '/')
 *    - Graceful fallback for unknown paths
 *    - Reactive popstate handling for back/forward browser navigation
 *    - Popstate with query parameters and ?photo deep links
 * 5. Programmatic Focus Management & Reduced Motion:
 *    - Heading receives focus (tabindex="-1") on all view transitions
 *    - Focus routing after cross-filtering
 *    - startViewTransition execution when supported
 *    - startViewTransition bypass when prefers-reduced-motion: reduce is active, preserving focus
 *    - Fallback focus routing when startViewTransition is undefined
 * 6. Empty State Fallbacks:
 *    - CollectionsView with empty collections array (aria-label, message)
 *    - AboutGearView with empty cameras, empty lenses, and completely empty inventory
 * 7. Adversarial Stress & Edge Cases:
 *    - Rapid multi-cycle tab switching (20 cycles)
 *    - Brand logo navigation from secondary views vs already on gallery
 *    - Filter isolation across cross-filtering transitions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import App from '../App';
import { CollectionsView } from '../components/CollectionsView';
import { AboutGearView } from '../components/AboutGearView';
import { defaultMockStore } from '../data/mockStore';
import { SEED_GEAR_INVENTORY } from '../data/seedCaptures';
import type { ActiveView, GearItem } from '../types/gallery';

describe('Empirical Challenger: Navigation, View Transitions, Cross-Filtering & History Sync', () => {
  beforeEach(() => {
    defaultMockStore.reset();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Top-Level Navigation Matrix across all 4 Views
  // =========================================================================
  describe('1. Top-Level Navigation Matrix & Active Nav Pill Styling', () => {
    const VIEWS: { id: ActiveView; label: RegExp; headingRegex: RegExp }[] = [
      { id: 'gallery', label: /^gallery$/i, headingRegex: /a moment, at home/i },
      { id: 'collections', label: /^collections$/i, headingRegex: /curated collections/i },
      { id: 'about', label: /^about$/i, headingRegex: /gear & optics inventory/i },
      { id: 'admin', label: /admin studio/i, headingRegex: /admin curation studio/i },
    ];

    it('enforces strict mutual exclusivity of active nav pill and renders correct headings', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });
      const getViewButton = (view: (typeof VIEWS)[number]) =>
        view.id === 'admin'
          ? screen.getByRole('button', { name: view.label })
          : within(nav).getByRole('button', { name: view.label });

      // Test every possible view transition
      for (const target of VIEWS) {
        const btn = getViewButton(target);
        fireEvent.click(btn);

        // Verify active indicator
        expect(btn).toHaveAttribute('aria-current', 'page');
        if (target.id !== 'admin') {
          expect(btn).toHaveClass('border-ink', 'text-ink', 'font-semibold');
        }

        // Verify all OTHER buttons are inactive
        for (const other of VIEWS) {
          if (other.id !== target.id) {
            const otherBtn = getViewButton(other);
            expect(otherBtn).not.toHaveAttribute('aria-current');
            if (other.id !== 'admin') {
              expect(otherBtn).toHaveClass('border-transparent', 'text-stone');
            }
          }
        }

        // Verify heading for target view is present
        expect(screen.getByRole('heading', { name: target.headingRegex })).toBeInTheDocument();
      }
    });

    it('unmounts inactive view content completely when switching views', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      // 1. In Gallery: Toolbar and view switcher are present
      expect(screen.getByRole('button', { name: /aspect-ratio masonry grid/i })).toBeInTheDocument();
      expect(screen.queryByTestId('collection-card-architecture')).not.toBeInTheDocument();
      expect(screen.queryByText(/archival principles/i)).not.toBeInTheDocument();

      // 2. In Collections: Toolbar is unmounted, collection cards are mounted
      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));
      expect(screen.queryByRole('button', { name: /aspect-ratio masonry grid/i })).not.toBeInTheDocument();
      expect(screen.getByTestId('collection-card-architecture')).toBeInTheDocument();
      expect(screen.queryByText(/archival principles/i)).not.toBeInTheDocument();

      // 3. In About: Collections and Toolbar unmounted, Bio & Gear mounted
      fireEvent.click(within(nav).getByRole('button', { name: /^about$/i }));
      expect(screen.queryByTestId('collection-card-architecture')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /aspect-ratio masonry grid/i })).not.toBeInTheDocument();
      expect(screen.getByText(/archival principles/i)).toBeInTheDocument();

      // 4. In Admin: Admin Studio table mounted, About unmounted
      fireEvent.click(screen.getByRole('button', { name: /admin studio/i }));
      expect(screen.queryByText(/archival principles/i)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /indexed d1 capture catalog/i })).toBeInTheDocument();
    });

    it('asserts accessible 40px touch targets (min-h-10) and visible focus rings on all nav buttons', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });
      const navButtons = within(nav).getAllByRole('button');

      expect(navButtons).toHaveLength(3);
      for (const btn of navButtons) {
        expect(btn).toHaveClass('min-h-10');
        expect(btn).toHaveClass(
          'focus-visible:outline-2'
        );
      }

      // Brand button inside header
      const header = screen.getByRole('banner');
      const brandBtn = within(header).getByRole('button', { name: /captures/i });
      expect(brandBtn).toHaveClass('min-h-10');
      expect(brandBtn).toHaveClass(
        'focus-visible:outline-2'
      );
    });

    it('clicking brand logo returns to gallery from any secondary view', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });
      const header = screen.getByRole('banner');
      const brandBtn = within(header).getByRole('button', { name: /captures/i });

      // Navigate to admin
      fireEvent.click(screen.getByRole('button', { name: /admin studio/i }));
      expect(screen.getByRole('heading', { level: 1, name: /admin curation studio/i })).toBeInTheDocument();

      // Click brand logo
      fireEvent.click(brandBtn);
      expect(within(nav).getByRole('button', { name: /^gallery$/i })).toHaveAttribute(
        'aria-current',
        'page'
      );
      expect(screen.getByRole('heading', { level: 1, name: /a moment, at home/i })).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. Cross-Filtering from Collections View to Gallery
  // =========================================================================
  describe('2. Cross-Filtering from Collections View to Gallery', () => {
    it('cross-filters to "architecture" collection, updates pills, and resets other filters', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      // First set search filter in Gallery to verify it gets cleared upon cross-filtering
      const searchInput = screen.getByPlaceholderText(/search title, location, camera/i);
      fireEvent.change(searchInput, { target: { value: 'concrete' } });
      expect(searchInput).toHaveValue('concrete');

      // Navigate to Collections
      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));

      // Click "Explore architectural geometry"
      const exploreBtn = screen.getByRole('button', {
        name: /explore architectural geometry/i,
      });
      fireEvent.click(exploreBtn);

      // Asserts view switched to Gallery
      expect(screen.getByRole('heading', { level: 1, name: /a moment, at home/i })).toBeInTheDocument();
      expect(within(nav).getByRole('button', { name: /^gallery$/i })).toHaveAttribute('aria-current', 'page');

      // Asserts collection pill is active
      const archPill = screen.getByRole('button', { name: /architectural geometry/i });
      expect(archPill).toHaveAttribute('aria-pressed', 'true');
      expect(archPill).toHaveClass('bg-ink', 'text-white');

      // Asserts search input was cleared by cross-filter
      const updatedSearchInput = screen.getByPlaceholderText(/search title, location, camera/i);
      expect(updatedSearchInput).toHaveValue('');

      // Asserts gallery only contains architecture captures
      expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
      expect(screen.getByText('Spiral concrete stairwell')).toBeInTheDocument();
      expect(screen.getByText('Nordic glass & timber pavilion')).toBeInTheDocument();
      expect(screen.queryByText('Shibuya rain reflections')).not.toBeInTheDocument();
      expect(screen.queryByText('Mist over Lake Biwa')).not.toBeInTheDocument();
    });

    it('cross-filters to "street" collection', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));
      fireEvent.click(screen.getByRole('button', { name: /explore nocturnal street & transit/i }));

      expect(screen.getByRole('heading', { level: 1, name: /a moment, at home/i })).toBeInTheDocument();
      const streetPill = screen.getByRole('button', { name: /nocturnal street & transit/i });
      expect(streetPill).toHaveAttribute('aria-pressed', 'true');

      expect(screen.getByText('Shibuya rain reflections')).toBeInTheDocument();
      expect(screen.getByText('Night market steam & neon')).toBeInTheDocument();
      expect(screen.queryByText('Brutalist concrete atrium')).not.toBeInTheDocument();
    });

    it('cross-filters to "minimalism" collection', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));
      fireEvent.click(screen.getByRole('button', { name: /explore atmospheric minimalism/i }));

      expect(screen.getByRole('heading', { level: 1, name: /a moment, at home/i })).toBeInTheDocument();
      const minPill = screen.getByRole('button', { name: /atmospheric minimalism/i });
      expect(minPill).toHaveAttribute('aria-pressed', 'true');

      expect(screen.getByText('Mist over Lake Biwa')).toBeInTheDocument();
      expect(screen.getByText('Solitary pine on basalt ridge')).toBeInTheDocument();
      expect(screen.getByText('Gypsum dune shadow line')).toBeInTheDocument();
      expect(screen.queryByText('Shibuya rain reflections')).not.toBeInTheDocument();
    });

    it('toggling active collection pill in Gallery after cross-filter restores all captures', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));
      fireEvent.click(screen.getByRole('button', { name: /explore atmospheric minimalism/i }));

      const minPill = screen.getByRole('button', { name: /atmospheric minimalism/i });
      expect(minPill).toHaveAttribute('aria-pressed', 'true');

      // Click the active pill again to toggle off
      fireEvent.click(minPill);
      expect(minPill).toHaveAttribute('aria-pressed', 'false');

      const allPill = screen.getByRole('button', { name: /all photographs/i });
      expect(allPill).toHaveAttribute('aria-pressed', 'true');

      // All captures are visible again
      expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
      expect(screen.getByText('Shibuya rain reflections')).toBeInTheDocument();
      expect(screen.getByText('Mist over Lake Biwa')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. Cross-Filtering from About & Gear View to Gallery
  // =========================================================================
  describe('3. Cross-Filtering from About & Gear View to Gallery', () => {
    it('cross-filters by camera model "Leica Q2" and sets camera selector', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      fireEvent.click(within(nav).getByRole('button', { name: /^about$/i }));
      const leicaBtn = screen.getByRole('button', { name: /view leica q2 captures/i });
      fireEvent.click(leicaBtn);

      expect(screen.getByRole('heading', { level: 1, name: /a moment, at home/i })).toBeInTheDocument();
      expect(within(nav).getByRole('button', { name: /^gallery$/i })).toHaveAttribute('aria-current', 'page');

      const cameraSelect = screen.getByLabelText(/camera or gear/i) as unknown as HTMLSelectElement;
      expect(cameraSelect.value).toBe('Leica Q2');

      // Asserts captures matching Leica Q2
      expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
      expect(screen.getByText('Night market steam & neon')).toBeInTheDocument();
      expect(screen.queryByText('Shibuya rain reflections')).not.toBeInTheDocument();
    });

    it('cross-filters by camera model "Sony A7R V"', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      fireEvent.click(within(nav).getByRole('button', { name: /^about$/i }));
      const sonyBtn = screen.getByRole('button', { name: /view sony a7r v captures/i });
      fireEvent.click(sonyBtn);

      const cameraSelect = screen.getByLabelText(/camera or gear/i) as unknown as HTMLSelectElement;
      expect(cameraSelect.value).toBe('Sony A7R V');

      expect(screen.getByText('Spiral concrete stairwell')).toBeInTheDocument();
      expect(screen.getByText('Nordic glass & timber pavilion')).toBeInTheDocument();
      expect(screen.queryByText('Brutalist concrete atrium')).not.toBeInTheDocument();
      expect(screen.queryByText('Shibuya rain reflections')).not.toBeInTheDocument();
    });

    it('cross-filters by reference lens "FE 24-70mm f/2.8 GM II" and renders fallback option in selector', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      fireEvent.click(within(nav).getByRole('button', { name: /^about$/i }));
      const lensBtn = screen.getByRole('button', {
        name: /view fe 24-70mm f\/2\.8 gm ii captures/i,
      });
      fireEvent.click(lensBtn);

      expect(screen.getByRole('heading', { level: 1, name: /a moment, at home/i })).toBeInTheDocument();

      const cameraSelect = screen.getByLabelText(/camera or gear/i) as unknown as HTMLSelectElement;
      expect(cameraSelect.value).toBe('FE 24-70mm f/2.8 GM II');

      // The fallback option must exist in the select
      const matchingOption = within(cameraSelect as unknown as HTMLElement).getByRole('option', {
        name: 'FE 24-70mm f/2.8 GM II',
      });
      expect(matchingOption).toBeInTheDocument();

      // Asserts captures shot with this lens
      expect(screen.getByText('Spiral concrete stairwell')).toBeInTheDocument();
      expect(screen.getByText('Nordic glass & timber pavilion')).toBeInTheDocument();
      expect(screen.queryByText('Shibuya rain reflections')).not.toBeInTheDocument();
    });

    it('cross-filters by lens "Summilux 28mm f/1.7 ASPH"', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      fireEvent.click(within(nav).getByRole('button', { name: /^about$/i }));
      const summiluxBtn = screen.getByRole('button', {
        name: /view summilux 28mm f\/1\.7 asph captures/i,
      });
      fireEvent.click(summiluxBtn);

      const cameraSelect = screen.getByLabelText(/camera or gear/i) as unknown as HTMLSelectElement;
      expect(cameraSelect.value).toBe('Summilux 28mm f/1.7 ASPH');

      expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
      expect(screen.getByText('Night market steam & neon')).toBeInTheDocument();
      expect(screen.queryByText('Shibuya rain reflections')).not.toBeInTheDocument();
    });

    it('clears collection and search filters when cross-filtering by gear', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      // First filter by collection in Gallery
      fireEvent.click(screen.getByRole('button', { name: /atmospheric minimalism/i }));
      expect(screen.getByRole('button', { name: /atmospheric minimalism/i })).toHaveAttribute(
        'aria-pressed',
        'true'
      );

      // Now navigate to About and select a gear item (Sony A7R V)
      fireEvent.click(within(nav).getByRole('button', { name: /^about$/i }));
      fireEvent.click(screen.getByRole('button', { name: /view sony a7r v captures/i }));

      // Collection filter should now be reset to "All captures"
      const allPill = screen.getByRole('button', { name: /all photographs/i });
      expect(allPill).toHaveAttribute('aria-pressed', 'true');

      // User sees Sony A7R V captures
      expect(screen.getByText('Spiral concrete stairwell')).toBeInTheDocument();
      expect(screen.getByText('Nordic glass & timber pavilion')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. Browser History Synchronization & Deep-Linking
  // =========================================================================
  describe('4. Browser History Synchronization & Deep-Linking', () => {
    it('initializes to Collections view when window.location.pathname is /collections', () => {
      window.history.replaceState({}, '', '/collections');
      render(<App />);

      const nav = screen.getByRole('navigation', { name: /primary navigation/i });
      expect(within(nav).getByRole('button', { name: /^collections$/i })).toHaveAttribute(
        'aria-current',
        'page'
      );
      expect(screen.getByRole('heading', { level: 1, name: /curated collections/i })).toBeInTheDocument();
    });

    it('initializes to About & gear view when window.location.pathname is /about', () => {
      window.history.replaceState({}, '', '/about');
      render(<App />);

      const nav = screen.getByRole('navigation', { name: /primary navigation/i });
      expect(within(nav).getByRole('button', { name: /^about$/i })).toHaveAttribute(
        'aria-current',
        'page'
      );
      expect(screen.getByRole('heading', { name: /gear & optics inventory/i })).toBeInTheDocument();
    });

    it('initializes to Admin studio view when window.location.pathname is /admin', () => {
      window.history.replaceState({}, '', '/admin');
      render(<App />);

      expect(screen.getByRole('button', { name: /admin studio/i })).toHaveAttribute(
        'aria-current',
        'page'
      );
      expect(screen.getByRole('heading', { level: 1, name: /admin curation studio/i })).toBeInTheDocument();
    });

    it('gracefully defaults to Gallery view when window.location.pathname is unknown', () => {
      window.history.replaceState({}, '', '/non-existent-subpath-404');
      render(<App />);

      const nav = screen.getByRole('navigation', { name: /primary navigation/i });
      expect(within(nav).getByRole('button', { name: /^gallery$/i })).toHaveAttribute(
        'aria-current',
        'page'
      );
      expect(screen.getByRole('heading', { level: 1, name: /a moment, at home/i })).toBeInTheDocument();
    });

    it('invokes window.history.pushState on navigation', () => {
      const pushStateSpy = vi.spyOn(window.history, 'pushState');
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));
      expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/collections');

      fireEvent.click(within(nav).getByRole('button', { name: /^about$/i }));
      expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/about');

      fireEvent.click(screen.getByRole('button', { name: /admin studio/i }));
      expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/admin');

      fireEvent.click(within(nav).getByRole('button', { name: /^gallery$/i }));
      expect(pushStateSpy).toHaveBeenCalledWith({}, '', '/');
    });

    it('reactively updates active view on window popstate events', async () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      // Emulate back button to /collections
      act(() => {
        window.history.replaceState({}, '', '/collections');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      await waitFor(() => {
        expect(within(nav).getByRole('button', { name: /^collections$/i })).toHaveAttribute(
          'aria-current',
          'page'
        );
        expect(screen.getByRole('heading', { level: 1, name: /curated collections/i })).toBeInTheDocument();
      });

      // Emulate forward button to /admin
      act(() => {
        window.history.replaceState({}, '', '/admin');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /admin studio/i })).toHaveAttribute(
          'aria-current',
          'page'
        );
        expect(screen.getByRole('heading', { level: 1, name: /admin curation studio/i })).toBeInTheDocument();
      });

      // Emulate back button to /
      act(() => {
        window.history.replaceState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      await waitFor(() => {
        expect(within(nav).getByRole('button', { name: /^gallery$/i })).toHaveAttribute(
          'aria-current',
          'page'
        );
        expect(screen.getByRole('heading', { level: 1, name: /a moment, at home/i })).toBeInTheDocument();
      });
    });

    it('handles popstate events with query parameters correctly', async () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      act(() => {
        window.history.replaceState({}, '', '/collections?utm_source=test&sort=order');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      await waitFor(() => {
        expect(within(nav).getByRole('button', { name: /^collections$/i })).toHaveAttribute(
          'aria-current',
          'page'
        );
      });
    });

    it('synchronizes ?photo=<slug> on popstate and opens lightbox over active view', async () => {
      render(<App />);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).not.toHaveAttribute('open');

      // Emulate deep link popstate to ?photo=brutalist-atrium-01
      act(() => {
        window.history.replaceState({}, '', '/?photo=brutalist-atrium-01');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      await waitFor(() => {
        expect(dialog).toHaveAttribute('open');
        expect(
          within(dialog).getByText('Brutalist concrete atrium')
        ).toBeInTheDocument();
      });

      // Emulate closing via popstate back to /
      act(() => {
        window.history.replaceState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      await waitFor(() => {
        expect(dialog).not.toHaveAttribute('open');
      });
    });
  });

  // =========================================================================
  // 5. Programmatic Focus Management & Reduced Motion
  // =========================================================================
  describe('5. Programmatic Focus Routing & Reduced Motion Respect', () => {
    it('routes programmatic focus to target headings on all view transitions', async () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      // Collections
      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));
      await waitFor(() => {
        const heading = document.getElementById('collections-view-heading');
        expect(heading).toHaveAttribute('tabindex', '-1');
        expect(document.activeElement).toBe(heading);
      });

      // About
      fireEvent.click(within(nav).getByRole('button', { name: /^about$/i }));
      await waitFor(() => {
        const heading = document.getElementById('about-view-heading');
        expect(heading).toHaveAttribute('tabindex', '-1');
        expect(document.activeElement).toBe(heading);
      });

      // Admin
      fireEvent.click(screen.getByRole('button', { name: /admin studio/i }));
      await waitFor(() => {
        const heading = document.getElementById('admin-view-heading');
        expect(heading).toHaveAttribute('tabindex', '-1');
        expect(document.activeElement).toBe(heading);
      });

      // Gallery
      fireEvent.click(within(nav).getByRole('button', { name: /^gallery$/i }));
      await waitFor(() => {
        const heading = document.getElementById('gallery-view-heading');
        expect(heading).toHaveAttribute('tabindex', '-1');
        expect(document.activeElement).toBe(heading);
      });
    });

    it('routes focus to #gallery-view-heading after cross-filtering from Collections', async () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));
      fireEvent.click(screen.getByRole('button', { name: /explore architectural geometry/i }));

      await waitFor(() => {
        const heading = document.getElementById('gallery-view-heading');
        expect(heading).toHaveAttribute('tabindex', '-1');
        expect(document.activeElement).toBe(heading);
      });
    });

    it('routes focus to #gallery-view-heading after cross-filtering from About & Gear', async () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      fireEvent.click(within(nav).getByRole('button', { name: /^about$/i }));
      fireEvent.click(screen.getByRole('button', { name: /view leica q2 captures/i }));

      await waitFor(() => {
        const heading = document.getElementById('gallery-view-heading');
        expect(heading).toHaveAttribute('tabindex', '-1');
        expect(document.activeElement).toBe(heading);
      });
    });

    it('routes focus correctly even when prefers-reduced-motion: reduce is requested', async () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));
      await waitFor(() => {
        const heading = document.getElementById('collections-view-heading');
        expect(heading).toHaveAttribute('tabindex', '-1');
        expect(document.activeElement).toBe(heading);
      });

      window.matchMedia = originalMatchMedia;
    });

    it('routes focus correctly when document.startViewTransition is completely undefined', async () => {
      const originalSVT = (document as any).startViewTransition;
      delete (document as any).startViewTransition;

      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: /admin studio/i }));
      await waitFor(() => {
        const heading = document.getElementById('admin-view-heading');
        expect(heading).toHaveAttribute('tabindex', '-1');
        expect(document.activeElement).toBe(heading);
      });

      if (originalSVT) {
        (document as any).startViewTransition = originalSVT;
      }
    });
  });

  // =========================================================================
  // 6. Empty State Fallbacks in Secondary Views
  // =========================================================================
  describe('6. Empty State Fallbacks in Secondary Views', () => {
    it('renders accessible empty state section when collections list is empty', () => {
      const onSelect = vi.fn();
      render(
        <CollectionsView
          collections={[]}
          captures={[]}
          onSelectCollection={onSelect}
        />
      );

      // Section has aria-label="No collections found"
      const emptySection = screen.getByRole('region', { name: /no collections found/i });
      expect(emptySection).toBeInTheDocument();
      expect(
        within(emptySection).getByRole('heading', { level: 2, name: /no collections available/i })
      ).toBeInTheDocument();
      expect(
        within(emptySection).getByText(
          /curated photographic series are currently being indexed or synchronized/i
        )
      ).toBeInTheDocument();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('renders empty notices in AboutGearView when gear lists are empty', () => {
      const onFilter = vi.fn();

      // Completely empty gear inventory
      render(
        <AboutGearView
          gearInventory={[]}
          onFilterByGear={onFilter}
        />
      );

      expect(
        screen.getByText('No camera bodies currently registered in the inventory.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('No lenses currently registered in the inventory.')
      ).toBeInTheDocument();

      // Bio statement still renders
      expect(screen.getByRole('heading', { name: /gear & optics inventory/i })).toBeInTheDocument();
      expect(screen.getByText(/archival principles/i)).toBeInTheDocument();
    });

    it('renders camera empty notice when only lenses are available', () => {
      const lensesOnly: GearItem[] = SEED_GEAR_INVENTORY.filter((g) => g.type === 'lens');
      render(
        <AboutGearView
          gearInventory={lensesOnly}
          onFilterByGear={vi.fn()}
        />
      );

      expect(
        screen.getByText('No camera bodies currently registered in the inventory.')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('No lenses currently registered in the inventory.')
      ).not.toBeInTheDocument();
      expect(screen.getByText('FE 24-70mm f/2.8 GM II')).toBeInTheDocument();
    });

    it('renders lens empty notice when only cameras are available', () => {
      const camerasOnly: GearItem[] = SEED_GEAR_INVENTORY.filter((g) => g.type === 'camera');
      render(
        <AboutGearView
          gearInventory={camerasOnly}
          onFilterByGear={vi.fn()}
        />
      );

      expect(
        screen.getByText('No lenses currently registered in the inventory.')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('No camera bodies currently registered in the inventory.')
      ).not.toBeInTheDocument();
      expect(screen.getByText('Leica Q2')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 7. Adversarial Stress & Edge Cases
  // =========================================================================
  describe('7. Adversarial Stress & Rapid Navigation', () => {
    it('survives 20 rapid cyclical view switches without DOM corruption or race conditions', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });
      const viewOrder: ActiveView[] = [
        'collections',
        'about',
        'admin',
        'gallery',
        'admin',
        'about',
        'collections',
        'gallery',
        'about',
        'admin',
        'gallery',
        'collections',
        'admin',
        'gallery',
        'about',
        'collections',
        'about',
        'admin',
        'collections',
        'gallery',
      ];

      for (const view of viewOrder) {
        const btn =
          view === 'admin'
            ? screen.getByRole('button', { name: /admin studio/i })
            : within(nav).getByRole('button', {
                name: new RegExp(view === 'about' ? '^about$' : `^${view}$`, 'i'),
              });
        fireEvent.click(btn);
      }

      // Final view must be Gallery
      expect(within(nav).getByRole('button', { name: /^gallery$/i })).toHaveAttribute(
        'aria-current',
        'page'
      );
      expect(screen.getByRole('heading', { level: 1, name: /a moment, at home/i })).toBeInTheDocument();
    });

    it('clicking already active view nav button does not break or cause redundant pushState', () => {
      const pushStateSpy = vi.spyOn(window.history, 'pushState');
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      const galleryBtn = within(nav).getByRole('button', { name: /^gallery$/i });
      fireEvent.click(galleryBtn);
      fireEvent.click(galleryBtn);

      expect(pushStateSpy).not.toHaveBeenCalled();
      expect(galleryBtn).toHaveAttribute('aria-current', 'page');
    });

    it('recovers cleanly from empty gallery results via Reset filters button after cross-filtering', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      // Cross-filter to architecture
      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));
      fireEvent.click(screen.getByRole('button', { name: /explore architectural geometry/i }));

      // In gallery, now add an impossible search query
      const searchInput = screen.getByPlaceholderText(/search title, location, camera/i);
      fireEvent.change(searchInput, { target: { value: 'unmatched-xyz-query-999' } });

      // Shows empty gallery state
      expect(screen.getByText('No captures match your current filters')).toBeInTheDocument();

      // Click "Reset filters" button inside empty state
      const resetBtn = screen.getByRole('button', { name: /reset filters/i });
      fireEvent.click(resetBtn);

      // Recovers all captures
      expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
      expect(screen.getByText('Shibuya rain reflections')).toBeInTheDocument();
      expect(screen.getByText('Mist over Lake Biwa')).toBeInTheDocument();
    });
  });
});
