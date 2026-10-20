/**
 * proposed_navigation.test.tsx
 *
 * Comprehensive Test Suite for Top-Level Navigation, URL Routing,
 * View Transitions & Cross-Filtering Coordination.
 *
 * Covers:
 * 1. Top Navbar: 4 primary navigation items (Gallery, Collections, About & gear, Admin studio)
 * 2. Active view indication via aria-current="page", color (#2563EB), and active background
 * 3. Cross-filtering from Collections to Gallery (selecting curated series card filters gallery)
 * 4. Cross-filtering from About & Gear to Gallery (selecting camera or lens filters gallery)
 * 5. Programmatic focus management (tabindex="-1" focus routing after view transition)
 * 6. History navigation & popstate event handling for browser back/forward buttons
 * 7. Modern Web Guidance view transitions (document.startViewTransition wrapper & reduced-motion respect)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import App from '../../src/App';
import { defaultMockStore } from '../../src/data/mockStore';

describe('Navigation, Routing & Cross-Filtering Test Suite', () => {
  beforeEach(() => {
    defaultMockStore.reset();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Top-Level Navbar & View Switching', () => {
    it('renders the 4 primary navigation destinations with Gallery active by default', () => {
      render(<App />);

      const nav = screen.getByRole('navigation', { name: /primary navigation/i });
      const galleryBtn = within(nav).getByRole('button', { name: /^gallery$/i });
      const collectionsBtn = within(nav).getByRole('button', { name: /^collections$/i });
      const aboutBtn = within(nav).getByRole('button', { name: /^about$/i });
      const adminBtn = screen.getByRole('button', { name: /admin studio/i });

      // Gallery is active initially
      expect(galleryBtn).toHaveAttribute('aria-current', 'page');
      expect(galleryBtn).toHaveClass('border-ink', 'text-ink', 'font-semibold');
      expect(collectionsBtn).not.toHaveAttribute('aria-current');
      expect(aboutBtn).not.toHaveAttribute('aria-current');
      expect(adminBtn).not.toHaveAttribute('aria-current');

      // Gallery view heading is present
      expect(
        screen.getByRole('heading', { level: 1, name: /a moment, at home/i })
      ).toBeInTheDocument();
    });

    it('switches between all 4 views sequentially and updates active navigation indicator', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      // 1. Switch to Collections
      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));
      expect(within(nav).getByRole('button', { name: /^collections$/i })).toHaveAttribute(
        'aria-current',
        'page'
      );
      expect(
        screen.getByRole('heading', { level: 1, name: /curated collections/i })
      ).toBeInTheDocument();

      // 2. Switch to About & gear
      fireEvent.click(within(nav).getByRole('button', { name: /^about$/i }));
      expect(within(nav).getByRole('button', { name: /^about$/i })).toHaveAttribute(
        'aria-current',
        'page'
      );
      expect(
        screen.getByRole('heading', { name: /gear & optics inventory/i })
      ).toBeInTheDocument();

      // 3. Switch to Admin studio
      fireEvent.click(screen.getByRole('button', { name: /admin studio/i }));
      expect(screen.getByRole('button', { name: /admin studio/i })).toHaveAttribute(
        'aria-current',
        'page'
      );
      expect(
        screen.getByRole('heading', { level: 1, name: /admin curation studio/i })
      ).toBeInTheDocument();

      // 4. Return to Gallery via brand logo button
      const brandBtn = screen.getByRole('button', { name: /captures/i });
      fireEvent.click(brandBtn);
      expect(within(nav).getByRole('button', { name: /^gallery$/i })).toHaveAttribute(
        'aria-current',
        'page'
      );
      expect(
        screen.getByRole('heading', { level: 1, name: /a moment, at home/i })
      ).toBeInTheDocument();
    });
  });

  describe('2. Cross-Filtering from Collections to Gallery', () => {
    it('filters gallery by collection when clicking explore button on a collection card', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      // Navigate to Collections view
      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));
      expect(
        screen.getByRole('heading', { level: 1, name: /curated collections/i })
      ).toBeInTheDocument();

      // Click "Explore architectural geometry"
      const exploreArchBtn = screen.getByRole('button', {
        name: /explore architectural geometry/i,
      });
      fireEvent.click(exploreArchBtn);

      // Verify redirection to Gallery view with collection filter active
      expect(
        screen.getByRole('heading', { level: 1, name: /a moment, at home/i })
      ).toBeInTheDocument();

      const archPill = screen.getByRole('button', { name: /architectural geometry/i });
      expect(archPill).toHaveAttribute('aria-pressed', 'true');
      expect(archPill).toHaveClass('bg-ink', 'text-white');

      // Verify filtered captures
      expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
      expect(screen.getByText('Spiral concrete stairwell')).toBeInTheDocument();
      expect(screen.getByText('Nordic glass & timber pavilion')).toBeInTheDocument();
      expect(screen.queryByText('Shibuya rain reflections')).not.toBeInTheDocument();
    });

    it('cross-filters to atmospheric minimalism collection', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));
      fireEvent.click(
        screen.getByRole('button', { name: /explore atmospheric minimalism/i })
      );

      expect(
        screen.getByRole('heading', { level: 1, name: /a moment, at home/i })
      ).toBeInTheDocument();

      const minPill = screen.getByRole('button', { name: /atmospheric minimalism/i });
      expect(minPill).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByText('Mist over Lake Biwa')).toBeInTheDocument();
      expect(screen.queryByText('Brutalist concrete atrium')).not.toBeInTheDocument();
    });
  });

  describe('3. Cross-Filtering from About & Gear to Gallery', () => {
    it('filters gallery by camera model when selecting a camera from Gear Inventory', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      // Navigate to About & gear
      fireEvent.click(within(nav).getByRole('button', { name: /^about$/i }));
      expect(
        screen.getByRole('heading', { name: /gear & optics inventory/i })
      ).toBeInTheDocument();

      // Click "View Leica Q2 captures"
      const leicaBtn = screen.getByRole('button', { name: /view leica q2 captures/i });
      fireEvent.click(leicaBtn);

      // Verify Gallery view with camera filter applied
      expect(
        screen.getByRole('heading', { level: 1, name: /a moment, at home/i })
      ).toBeInTheDocument();

      const cameraSelect = screen.getByLabelText(/camera or gear/i) as unknown as HTMLSelectElement;
      expect(cameraSelect.value).toBe('Leica Q2');

      // Asserts captures shot on Leica Q2
      expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
      expect(screen.getByText('Night market steam & neon')).toBeInTheDocument();
      expect(screen.queryByText('Shibuya rain reflections')).not.toBeInTheDocument();
    });

    it('filters gallery by reference lens when selecting a lens from Gear Inventory', () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      fireEvent.click(within(nav).getByRole('button', { name: /^about$/i }));

      // Click "View FE 24-70mm f/2.8 GM II captures"
      const lensBtn = screen.getByRole('button', {
        name: /view fe 24-70mm f\/2\.8 gm ii captures/i,
      });
      fireEvent.click(lensBtn);

      expect(
        screen.getByRole('heading', { level: 1, name: /a moment, at home/i })
      ).toBeInTheDocument();
      expect(screen.getByText('Spiral concrete stairwell')).toBeInTheDocument();
      expect(screen.queryByText('Shibuya rain reflections')).not.toBeInTheDocument();
    });
  });

  describe('4. Programmatic Focus Management & Accessibility Routing', () => {
    it('routes programmatic focus to the target heading when switching views', async () => {
      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      // 1. Switch to Collections -> Focus moves to collections heading
      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));
      await waitFor(() => {
        const heading = document.getElementById('collections-view-heading');
        expect(heading).toHaveAttribute('tabindex', '-1');
        expect(document.activeElement).toBe(heading);
      });

      // 2. Switch to About & gear -> Focus moves to about heading
      fireEvent.click(within(nav).getByRole('button', { name: /^about$/i }));
      await waitFor(() => {
        const heading = document.getElementById('about-view-heading');
        expect(heading).toHaveAttribute('tabindex', '-1');
        expect(document.activeElement).toBe(heading);
      });

      // 3. Switch to Admin studio -> Focus moves to admin heading
      fireEvent.click(screen.getByRole('button', { name: /admin studio/i }));
      await waitFor(() => {
        const heading = document.getElementById('admin-view-heading');
        expect(heading).toHaveAttribute('tabindex', '-1');
        expect(document.activeElement).toBe(heading);
      });

      // 4. Return to Gallery -> Focus moves to gallery heading
      fireEvent.click(within(nav).getByRole('button', { name: /^gallery$/i }));
      await waitFor(() => {
        const heading = document.getElementById('gallery-view-heading');
        expect(heading).toHaveAttribute('tabindex', '-1');
        expect(document.activeElement).toBe(heading);
      });
    });
  });

  describe('5. View Transitions & Reduced Motion Respect', () => {
    it('uses document.startViewTransition when supported by browser', async () => {
      const mockTransition = {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
      };
      const startViewTransitionSpy = vi.fn().mockImplementation((cb: () => void) => {
        cb();
        return mockTransition;
      });
      (document as any).startViewTransition = startViewTransitionSpy;

      render(<App />);
      const nav = screen.getByRole('navigation', { name: /primary navigation/i });

      fireEvent.click(within(nav).getByRole('button', { name: /^collections$/i }));
      expect(startViewTransitionSpy).toHaveBeenCalled();

      delete (document as any).startViewTransition;
    });

    it('bypasses document.startViewTransition when user prefers reduced motion', () => {
      const startViewTransitionSpy = vi.fn();
      (document as any).startViewTransition = startViewTransitionSpy;

      // Mock prefers-reduced-motion: reduce
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
      expect(startViewTransitionSpy).not.toHaveBeenCalled();
      expect(
        screen.getByRole('heading', { level: 1, name: /curated collections/i })
      ).toBeInTheDocument();

      window.matchMedia = originalMatchMedia;
      delete (document as any).startViewTransition;
    });
  });

  describe('6. Browser History & PopState Support', () => {
    it('updates active view upon window popstate events', async () => {
      render(<App />);
      expect(
        screen.getByRole('heading', { level: 1, name: /a moment, at home/i })
      ).toBeInTheDocument();

      // Simulate popstate navigation to /admin
      act(() => {
        window.history.replaceState({}, '', '/admin');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 1, name: /admin curation studio/i })
        ).toBeInTheDocument();
      });

      // Simulate popstate navigation back to /
      act(() => {
        window.history.replaceState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      await waitFor(() => {
        expect(
          screen.getByRole('heading', { level: 1, name: /a moment, at home/i })
        ).toBeInTheDocument();
      });
    });
  });
});
