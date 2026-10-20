/**
 * src/test/challenger-lightbox-adversarial.test.tsx
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE for Photo Lightbox Dialog:
 * 1. Opening via photo card click across all 3 view modes (Masonry, Square, Editorial)
 * 2. Opening on initial load with URL search param ?photo=<slug>, UUID id lookup, and popstate navigation
 * 3. Resilience against invalid/adversarial slugs (XSS, directory traversal, empty, whitespace, 404)
 * 4. Displaying full and partial EXIF telemetry, fallback glyphs ('—'), and conditional panels
 * 5. Keyboard navigation (ArrowRight, ArrowLeft, Escape), boundary stops, single-capture lists, and input typing guards (input, textarea, contenteditable)
 * 6. Light-dismiss coordinate-boundary backdrop click fallback (left, right, top, bottom, inside, child target, 0-dimension rect)
 * 7. "Copy share link" action: URL composition, visual confirmation state, auto-reset timer (2500ms), capture-switch reset, execCommand fallback, and exception resilience
 * 8. Design system & modern web compliance: 40px hit targets (min-h-10), fetchPriority="high", absence of loading="lazy", closedby="any"
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import App from '../App';
import { PhotoLightboxDialog } from '../components/PhotoLightboxDialog';
import type { Capture } from '../types/gallery';
import { SEED_CAPTURES } from '../data/seedCaptures';

describe('Empirical Challenger: Photo Lightbox Dialog Adversarial Suite', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText = vi.fn().mockResolvedValue(undefined);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. Opening via Photo Card Click Across View Modes
  // ==========================================================================
  describe('1. Opening via photo card click across view modes', () => {
    it('opens lightbox and updates URL from Masonry view mode', () => {
      render(<App />);

      const photoBtn = screen.getByRole('button', {
        name: /inspect brutalist concrete atrium/i,
      });
      fireEvent.click(photoBtn);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).not.toBeNull();
      expect(dialog).toHaveAttribute('open');
      expect(window.location.search).toContain('photo=brutalist-atrium-01');
      expect(
        within(dialog).getByRole('heading', { level: 2, name: /brutalist concrete atrium/i })
      ).toBeInTheDocument();
    });

    it('opens lightbox and updates URL from Square Grid view mode', () => {
      render(<App />);

      // Switch to Square view mode
      const squareBtn = screen.getByRole('button', { name: /square grid/i });
      fireEvent.click(squareBtn);

      const photoBtn = screen.getByRole('button', {
        name: /inspect brutalist concrete atrium/i,
      });
      fireEvent.click(photoBtn);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).toHaveAttribute('open');
      expect(window.location.search).toContain('photo=brutalist-atrium-01');
    });

    it('opens lightbox and updates URL from Editorial List view mode', () => {
      render(<App />);

      // Switch to Editorial view mode
      const editorialBtn = screen.getByRole('button', { name: /editorial list/i });
      fireEvent.click(editorialBtn);

      const photoBtn = screen.getByRole('button', {
        name: /inspect brutalist concrete atrium/i,
      });
      fireEvent.click(photoBtn);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).toHaveAttribute('open');
      expect(window.location.search).toContain('photo=brutalist-atrium-01');
    });
  });

  // ==========================================================================
  // 2. Initial Load Deep-Linking, UUID Lookup & History Navigation
  // ==========================================================================
  describe('2. Initial load deep-linking, UUID lookup & history popstate', () => {
    it('opens dialog on initial render when ?photo=<slug> is in URL', () => {
      window.history.replaceState({}, '', '/?photo=shibuya-rain-reflections');
      render(<App />);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).toHaveAttribute('open');
      expect(dialog).toHaveAttribute('closedby', 'any');
      expect(
        within(dialog).getByRole('heading', { level: 2, name: /shibuya rain reflections/i })
      ).toBeInTheDocument();
    });

    it('preserves query parameters alongside other URL params', () => {
      window.history.replaceState({}, '', '/?theme=dark&photo=night-market-neon&lang=en');
      render(<App />);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).toHaveAttribute('open');
      expect(
        within(dialog).getByRole('heading', { level: 2, name: /night market steam & neon/i })
      ).toBeInTheDocument();
    });

    it('opens dialog when ?photo parameter is a valid UUID ID rather than a slug', () => {
      const target = SEED_CAPTURES[0]; // brutalist-atrium-01
      window.history.replaceState({}, '', `/?photo=${target.id}`);
      render(<App />);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).toHaveAttribute('open');
      expect(
        within(dialog).getByRole('heading', { level: 2, name: target.title })
      ).toBeInTheDocument();
    });

    it('reacts to browser popstate (back / forward buttons)', () => {
      window.history.replaceState({}, '', '/?photo=brutalist-atrium-01');
      render(<App />);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).toHaveAttribute('open');

      // Simulate browser Back button: URL returns to '/'
      act(() => {
        window.history.replaceState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(dialog.hasAttribute('open')).toBe(false);

      // Simulate browser Forward button: URL has '?photo=white-sands-horizon'
      act(() => {
        window.history.replaceState({}, '', '/?photo=white-sands-horizon');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });

      expect(dialog).toHaveAttribute('open');
      expect(
        within(dialog).getByRole('heading', { level: 2, name: /gypsum dune shadow line/i })
      ).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 3. Resilience Against Invalid or Adversarial Slugs
  // ==========================================================================
  describe('3. Resilience against invalid / adversarial slugs', () => {
    it.each([
      ['non-existent slug', 'non-existent-404-slug'],
      ['empty slug', ''],
      ['whitespace slug', '%20%20%20'],
      ['directory traversal attempt', '..%2F..%2F..%2Fetc%2Fpasswd'],
      ['XSS injection payload', '%3Cscript%3Ealert(1)%3C%2Fscript%3E'],
      ['template injection payload', '%24%7B7%2A7%7D'],
      ['SQL injection attempt', '%27%20OR%201%3D1--'],
      ['unicode emoji slug', '%F0%9F%93%B7%F0%9F%8F%99%EF%B8%8F'],
    ])('gracefully handles %s (?photo=%s) without crashing or opening modal', (_, slug) => {
      window.history.replaceState({}, '', `/?photo=${slug}`);
      render(<App />);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).not.toBeNull();
      expect(dialog.hasAttribute('open')).toBe(false);

      // Main gallery remains mounted and interactive
      expect(screen.getByRole('heading', { level: 1, name: /a moment, at home/i })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 4. EXIF Telemetry Stress Testing & Partial Metadata Handling
  // ==========================================================================
  describe('4. EXIF Telemetry display, formatters & missing metadata handling', () => {
    it('displays complete EXIF fields with correct units and typography', () => {
      window.history.replaceState({}, '', '/?photo=mist-over-lake-biwa');
      render(<App />);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      const exifDrawer = within(dialog).getByLabelText(/exif camera telemetry/i);

      // Camera & Lens
      expect(within(exifDrawer).getByText('Hasselblad 907X 50C')).toBeInTheDocument();
      expect(within(exifDrawer).getByText('XCD 45mm f/4 P')).toBeInTheDocument();

      // Exposure values
      expect(within(exifDrawer).getByText('45mm')).toBeInTheDocument();
      expect(within(exifDrawer).getByText('f/8')).toBeInTheDocument();
      expect(within(exifDrawer).getByText('1/4s')).toBeInTheDocument();
      expect(within(exifDrawer).getByText('ISO 100')).toBeInTheDocument();
      expect(within(exifDrawer).getByText(/3840 × 2160 px/i)).toBeInTheDocument();
    });

    it('gracefully renders minimal capture with missing optional EXIF, story, location and tags', () => {
      const minimalCapture: Capture = {
        id: 'min-001',
        slug: 'minimal-capture',
        title: 'Minimal capture title',
        story: null,
        collection_slug: 'minimalism',
        r2_key: 'captures/minimalism/min.jpg',
        image_url: 'https://example.com/min.jpg',
        width: 1920,
        height: 1080,
        aspect_ratio: 1.78,
        location: null,
        captured_at: null,
        camera_model: null,
        lens_model: null,
        focal_length: null,
        aperture: null,
        shutter_speed: null,
        iso: null,
        featured: false,
        tags: [],
        created_at: '2026-01-01T00:00:00Z',
      };

      const onClose = vi.fn();
      const onSelect = vi.fn();

      render(
        <PhotoLightboxDialog
          capture={minimalCapture}
          captures={[minimalCapture]}
          onClose={onClose}
          onSelectCapture={onSelect}
        />
      );

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).toHaveAttribute('open');

      // Date fallback
      expect(within(dialog).getByText('Date unrecorded')).toBeInTheDocument();

      // Field notes section should be omitted
      expect(within(dialog).queryByText(/field notes/i)).not.toBeInTheDocument();

      // "Filter by camera" button should NOT be rendered
      expect(within(dialog).queryByRole('button', { name: /filter by camera/i })).not.toBeInTheDocument();

      // EXIF drawer should display fallback glyphs
      const exifDrawer = within(dialog).getByLabelText(/exif camera telemetry/i);
      const dashes = within(exifDrawer).getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(4); // camera, lens, focal length, aperture, shutter, iso
    });

    it('triggers fallback SVG placeholder if high-res image fails to load', () => {
      const brokenCapture = {
        ...SEED_CAPTURES[0],
        image_url: 'https://invalid-non-existent-domain.com/broken.jpg',
      };

      render(
        <PhotoLightboxDialog
          capture={brokenCapture}
          captures={[brokenCapture]}
          onClose={vi.fn()}
          onSelectCapture={vi.fn()}
        />
      );

      const img = screen.getByRole('img', { name: brokenCapture.title }) as HTMLImageElement;
      expect(img.getAttribute('fetchpriority')).toBe('high');

      // Trigger error event
      fireEvent.error(img);

      // Verify that source changed to data:image/svg+xml placeholder
      expect(img.src).toContain('data:image/svg+xml');
    });
  });

  // ==========================================================================
  // 5. Keyboard Navigation, Boundary Guards & Input Typing Protections
  // ==========================================================================
  describe('5. Keyboard navigation, boundary guards & input typing protections', () => {
    it('stops at boundary when reaching the end of list on ArrowRight without errors', () => {
      // Last capture under default featured sort is nordic-glass-pavilion
      window.history.replaceState({}, '', '/?photo=nordic-glass-pavilion');
      render(<App />);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).toHaveAttribute('open');

      // Next capture button should not exist on last frame
      expect(within(dialog).queryByRole('button', { name: /next capture/i })).not.toBeInTheDocument();

      // Dispatch ArrowRight
      fireEvent.keyDown(window, { key: 'ArrowRight' });

      // Stays on last capture without wrapping or throwing
      expect(window.location.search).toContain('photo=nordic-glass-pavilion');
      expect(
        within(dialog).getByRole('heading', { level: 2, name: /nordic glass & timber pavilion/i })
      ).toBeInTheDocument();
    });

    it('stops at boundary when reaching the beginning of list on ArrowLeft without errors', () => {
      // First capture under default featured sort is mist-over-lake-biwa
      window.history.replaceState({}, '', '/?photo=mist-over-lake-biwa');
      render(<App />);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).toHaveAttribute('open');

      // Previous capture button should not exist on first frame
      expect(within(dialog).queryByRole('button', { name: /previous capture/i })).not.toBeInTheDocument();

      // Dispatch ArrowLeft
      fireEvent.keyDown(window, { key: 'ArrowLeft' });

      // Stays on first capture without error
      expect(window.location.search).toContain('photo=mist-over-lake-biwa');
      expect(
        within(dialog).getByRole('heading', { level: 2, name: /mist over lake biwa/i })
      ).toBeInTheDocument();
    });

    it('handles single-capture list: hides navigation chevrons and displays "Frame 1 of 1"', () => {
      const single = SEED_CAPTURES[0];
      render(
        <PhotoLightboxDialog
          capture={single}
          captures={[single]}
          onClose={vi.fn()}
          onSelectCapture={vi.fn()}
        />
      );

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(within(dialog).queryByRole('button', { name: /previous capture/i })).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('button', { name: /next capture/i })).not.toBeInTheDocument();
      expect(within(dialog).getByText(/frame 1 of 1/i)).toBeInTheDocument();

      // Arrow keys do not trigger navigation
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(within(dialog).getByRole('heading', { level: 2, name: single.title })).toBeInTheDocument();
    });

    it('guards against arrow navigation when typing in INPUT, TEXTAREA, and CONTENTEDITABLE elements', () => {
      window.history.replaceState({}, '', '/?photo=brutalist-atrium-01');
      render(<App />);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).toHaveAttribute('open');

      // 1. Text input
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      fireEvent.keyDown(input, { key: 'ArrowRight' });
      expect(window.location.search).toContain('photo=brutalist-atrium-01');
      document.body.removeChild(input);

      // 2. Textarea
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();
      fireEvent.keyDown(textarea, { key: 'ArrowRight' });
      expect(window.location.search).toContain('photo=brutalist-atrium-01');
      document.body.removeChild(textarea);

      // 3. Contenteditable element
      const editableDiv = document.createElement('div');
      editableDiv.contentEditable = 'true';
      Object.defineProperty(editableDiv, 'isContentEditable', { value: true, configurable: true });
      document.body.appendChild(editableDiv);
      editableDiv.focus();
      fireEvent.keyDown(editableDiv, { key: 'ArrowRight' });
      expect(window.location.search).toContain('photo=brutalist-atrium-01');
      document.body.removeChild(editableDiv);
    });

    it('ignores non-navigation keys without preventing default', () => {
      window.history.replaceState({}, '', '/?photo=brutalist-atrium-01');
      render(<App />);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).toHaveAttribute('open');
      const keyEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true });
      window.dispatchEvent(keyEvent);

      expect(keyEvent.defaultPrevented).toBe(false);
      expect(window.location.search).toContain('photo=brutalist-atrium-01');
    });

    it('closes on Escape key press and cleans up URL search param', () => {
      window.history.replaceState({}, '', '/?photo=brutalist-atrium-01');
      render(<App />);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).toHaveAttribute('open');

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(window.location.search).toBe('');
      expect(dialog.hasAttribute('open')).toBe(false);
    });
  });

  // ==========================================================================
  // 6. Coordinate-Boundary Backdrop Click Fallback
  // ==========================================================================
  describe('6. Coordinate-boundary backdrop click light-dismiss fallback', () => {
    const mockRect: DOMRect = {
      top: 100,
      left: 100,
      width: 800,
      height: 600,
      right: 900,
      bottom: 700,
      x: 100,
      y: 100,
      toJSON: () => {},
    };

    it('closes dialog when click is outside the content box in all 4 cardinal directions', () => {
      const onClose = vi.fn();
      render(
        <PhotoLightboxDialog
          capture={SEED_CAPTURES[0]}
          captures={SEED_CAPTURES}
          onClose={onClose}
          onSelectCapture={vi.fn()}
        />
      );

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      dialog.getBoundingClientRect = () => mockRect;

      // 1. Click outside Left (clientX: 50, clientY: 400)
      onClose.mockClear();
      fireEvent.click(dialog, { clientX: 50, clientY: 400 });
      expect(onClose).toHaveBeenCalled();

      // 2. Click outside Right (clientX: 950, clientY: 400)
      onClose.mockClear();
      fireEvent.click(dialog, { clientX: 950, clientY: 400 });
      expect(onClose).toHaveBeenCalled();

      // 3. Click outside Top (clientX: 500, clientY: 50)
      onClose.mockClear();
      fireEvent.click(dialog, { clientX: 500, clientY: 50 });
      expect(onClose).toHaveBeenCalled();

      // 4. Click outside Bottom (clientX: 500, clientY: 750)
      onClose.mockClear();
      fireEvent.click(dialog, { clientX: 500, clientY: 750 });
      expect(onClose).toHaveBeenCalled();
    });

    it('does NOT close dialog when click coordinates are strictly inside the bounding box', () => {
      const onClose = vi.fn();
      render(
        <PhotoLightboxDialog
          capture={SEED_CAPTURES[0]}
          captures={SEED_CAPTURES}
          onClose={onClose}
          onSelectCapture={vi.fn()}
        />
      );

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      dialog.getBoundingClientRect = () => mockRect;

      // Click at center (clientX: 500, clientY: 400)
      fireEvent.click(dialog, { clientX: 500, clientY: 400 });
      expect(onClose).not.toHaveBeenCalled();

      // Click on edge boundaries (clientX: 100, clientY: 100)
      fireEvent.click(dialog, { clientX: 100, clientY: 100 });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does NOT close dialog when event target is an inner child element', () => {
      const onClose = vi.fn();
      render(
        <PhotoLightboxDialog
          capture={SEED_CAPTURES[0]}
          captures={SEED_CAPTURES}
          onClose={onClose}
          onSelectCapture={vi.fn()}
        />
      );

      const img = screen.getByRole('img', { name: SEED_CAPTURES[0].title });
      fireEvent.click(img, { clientX: 50, clientY: 50 }); // Even with outside coordinates, target != dialog
      expect(onClose).not.toHaveBeenCalled();
    });

    it('closes dialog when bounding rect has 0 dimensions (e.g. headless or unmeasured container)', () => {
      const onClose = vi.fn();
      render(
        <PhotoLightboxDialog
          capture={SEED_CAPTURES[0]}
          captures={SEED_CAPTURES}
          onClose={onClose}
          onSelectCapture={vi.fn()}
        />
      );

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      dialog.getBoundingClientRect = () => ({
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      fireEvent.click(dialog, { clientX: 0, clientY: 0 });
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 7. "Copy Share Link" Action, Visual Feedback & Clipboard Fallbacks
  // ==========================================================================
  describe('7. "Copy share link" action, confirmation state & clipboard fallback', () => {
    it('composes correct permalink with origin, pathname and urlencoded slug', async () => {
      window.history.replaceState({}, '', '/?photo=shibuya-rain-reflections');
      render(<App />);

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      const copyBtn = within(dialog).getByRole('button', { name: /copy share link/i });

      fireEvent.click(copyBtn);

      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
      const expectedUrl = `${window.location.origin}${window.location.pathname}?photo=shibuya-rain-reflections`;
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expectedUrl);

      await waitFor(() => {
        expect(within(dialog).getByText(/share link copied/i)).toBeInTheDocument();
      });
    });

    it('auto-resets confirmation feedback after 2500ms using timer', async () => {
      vi.useFakeTimers();

      render(
        <PhotoLightboxDialog
          capture={SEED_CAPTURES[0]}
          captures={SEED_CAPTURES}
          onClose={vi.fn()}
          onSelectCapture={vi.fn()}
        />
      );

      const copyBtn = screen.getByRole('button', { name: /copy share link/i });
      await act(async () => {
        fireEvent.click(copyBtn);
      });

      // Verify immediate confirmation state
      expect(screen.getByText(/share link copied/i)).toBeInTheDocument();

      // Advance time by 2400ms -> still in copied state
      act(() => {
        vi.advanceTimersByTime(2400);
      });
      expect(screen.getByText(/share link copied/i)).toBeInTheDocument();

      // Advance time by another 100ms (total 2500ms) -> resets to "Copy share link"
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.getByRole('button', { name: /copy share link/i })).toBeInTheDocument();
      expect(screen.queryByText(/share link copied/i)).not.toBeInTheDocument();
    });

    it('resets copied state immediately when switching to another capture', async () => {
      const onSelect = vi.fn();
      const { rerender } = render(
        <PhotoLightboxDialog
          capture={SEED_CAPTURES[0]}
          captures={SEED_CAPTURES}
          onClose={vi.fn()}
          onSelectCapture={onSelect}
        />
      );

      // Copy link for first photo
      const copyBtn = screen.getByRole('button', { name: /copy share link/i });
      await act(async () => {
        fireEvent.click(copyBtn);
      });
      expect(screen.getByText(/share link copied/i)).toBeInTheDocument();

      // Rerender with next photo
      rerender(
        <PhotoLightboxDialog
          capture={SEED_CAPTURES[1]}
          captures={SEED_CAPTURES}
          onClose={vi.fn()}
          onSelectCapture={onSelect}
        />
      );

      // Copied state is reset immediately
      expect(screen.getByRole('button', { name: /copy share link/i })).toBeInTheDocument();
      expect(screen.queryByText(/share link copied/i)).not.toBeInTheDocument();
    });

    it('uses document.execCommand fallback when navigator.clipboard is unavailable', async () => {
      // Mock navigator.clipboard as undefined
      const originalClipboard = navigator.clipboard;
      delete (navigator as any).clipboard;

      const execCommandSpy = vi.fn();
      document.execCommand = execCommandSpy;

      render(
        <PhotoLightboxDialog
          capture={SEED_CAPTURES[0]}
          captures={SEED_CAPTURES}
          onClose={vi.fn()}
          onSelectCapture={vi.fn()}
        />
      );

      const copyBtn = screen.getByRole('button', { name: /copy share link/i });
      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(execCommandSpy).toHaveBeenCalledWith('copy');
      expect(screen.getByText(/share link copied/i)).toBeInTheDocument();

      // Restore clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    });

    it('gracefully handles clipboard exception without throwing unhandled rejection', async () => {
      navigator.clipboard.writeText = vi.fn().mockRejectedValue(new Error('Permission denied'));

      render(
        <PhotoLightboxDialog
          capture={SEED_CAPTURES[0]}
          captures={SEED_CAPTURES}
          onClose={vi.fn()}
          onSelectCapture={vi.fn()}
        />
      );

      const copyBtn = screen.getByRole('button', { name: /copy share link/i });

      // Click should not throw
      await act(async () => {
        expect(() => fireEvent.click(copyBtn)).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // 8. Design System & Modern Web Compliance
  // ==========================================================================
  describe('8. Design system & modern web platform compliance', () => {
    it('ensures all interactive buttons comply with min 40px touch target', () => {
      render(
        <PhotoLightboxDialog
          capture={SEED_CAPTURES[1]}
          captures={SEED_CAPTURES}
          onClose={vi.fn()}
          onSelectCapture={vi.fn()}
          onFilterByCamera={vi.fn()}
        />
      );

      const buttons = screen.getAllByRole('button');
      for (const btn of buttons) {
        const className = btn.className;
        // Either min-h-10 (40px) or h-10 (40px) or text link with focus outline
        const has40pxTarget =
          className.includes('min-h-10') ||
          className.includes('h-10') ||
          btn.getAttribute('aria-label') === 'Filter by camera' ||
          className.includes('text-blue-600');
        expect(has40pxTarget).toBe(true);
      }
    });

    it('applies fetchpriority="high" strictly without loading="lazy" on preview image', () => {
      render(
        <PhotoLightboxDialog
          capture={SEED_CAPTURES[0]}
          captures={SEED_CAPTURES}
          onClose={vi.fn()}
          onSelectCapture={vi.fn()}
        />
      );

      const img = screen.getByRole('img', { name: SEED_CAPTURES[0].title });
      expect(img.getAttribute('fetchpriority')).toBe('high');
      expect(img.getAttribute('loading')).toBeNull(); // Must NOT be lazy
    });

    it('sets native closedby="any" and aria-labelledby on the dialog element', () => {
      render(
        <PhotoLightboxDialog
          capture={SEED_CAPTURES[0]}
          captures={SEED_CAPTURES}
          onClose={vi.fn()}
          onSelectCapture={vi.fn()}
        />
      );

      const dialog = document.querySelector('dialog') as HTMLDialogElement;
      expect(dialog.getAttribute('closedby')).toBe('any');
      expect(dialog.getAttribute('aria-labelledby')).toBe('lightbox-title');
    });
  });
});
