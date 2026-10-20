/**
 * src/test/lightbox.test.tsx
 *
 * Lightbox Dialog Architecture, Navigation, Deep-Linking & EXIF Telemetry Tests:
 * - Native <dialog closedby="any"> opened via showModal()
 * - Initial load deep-linking via ?photo=<slug> URL search parameter
 * - Graceful fallback on non-existent photo slug
 * - Opening on photo card click in gallery with URL sync
 * - Complete EXIF telemetry drawer (camera, lens, focal length, aperture, shutter speed, ISO, resolution)
 * - Sequential navigation via Next/Previous chevrons and counter pill
 * - Keyboard navigation (ArrowRight, ArrowLeft, Escape) with input element guard
 * - Close buttons (X and Done) clearing URL parameter
 * - Coordinate-boundary backdrop click light-dismiss fallback
 * - "Copy share link" action with clipboard API and visual confirmation feedback
 * - "Filter by camera" cross-filtering from EXIF drawer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../App';

describe('Photo Lightbox Dialog — Deep-Linking, EXIF Telemetry, Navigation & Clipboard', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText = vi.fn().mockResolvedValue(undefined);
    }
  });

  it('opens dialog automatically on initial render via ?photo=<slug> URL deep-link', () => {
    window.history.replaceState({}, '', '/?photo=shibuya-rain-reflections');
    render(<App />);

    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    expect(dialog).not.toBeNull();
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('closedby', 'any');

    expect(within(dialog).getByRole('heading', { level: 2, name: 'Shibuya rain reflections' })).toBeInTheDocument();
    expect(within(dialog).getByText('Fujifilm X-T5')).toBeInTheDocument();
    expect(within(dialog).getByText('Fujinon XF 33mm f/1.4 R LM WR')).toBeInTheDocument();
  });

  it('gracefully handles non-existent ?photo=<slug> without opening or crashing', () => {
    window.history.replaceState({}, '', '/?photo=invalid-slug-404');
    render(<App />);

    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('opens dialog on photo card click in gallery and synchronizes URL search parameter', () => {
    render(<App />);

    const photoCardBtn = screen.getByRole('button', {
      name: /inspect brutalist concrete atrium/i,
    });
    fireEvent.click(photoCardBtn);

    expect(window.location.search).toContain('photo=brutalist-atrium-01');

    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    expect(dialog).toHaveAttribute('open');
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Brutalist concrete atrium' })).toBeInTheDocument();
  });

  it('displays structured EXIF camera telemetry drawer with formatted values', () => {
    window.history.replaceState({}, '', '/?photo=brutalist-atrium-01');
    render(<App />);

    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    const exifPanel = within(dialog).getByLabelText(/exif camera telemetry/i);

    expect(within(exifPanel).getByText('Camera body')).toBeInTheDocument();
    expect(within(exifPanel).getByText('Leica Q2')).toBeInTheDocument();

    expect(within(exifPanel).getByText('Optics / lens')).toBeInTheDocument();
    expect(within(exifPanel).getByText('Summilux 28mm f/1.7 ASPH')).toBeInTheDocument();

    expect(within(exifPanel).getByText('28mm')).toBeInTheDocument();
    expect(within(exifPanel).getByText('f/2.8')).toBeInTheDocument();
    expect(within(exifPanel).getByText('1/250s')).toBeInTheDocument();
    expect(within(exifPanel).getByText('ISO 100')).toBeInTheDocument();
    expect(within(exifPanel).getByText(/3840 × 2560 px/i)).toBeInTheDocument();
  });

  it('navigates sequentially using onscreen chevron buttons and sequence counter', () => {
    window.history.replaceState({}, '', '/?photo=brutalist-atrium-01');
    render(<App />);

    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    expect(within(dialog).getByText(/frame \d+ of 8/i)).toBeInTheDocument();

    // Click Next capture chevron
    const nextBtn = within(dialog).getByRole('button', { name: /next capture/i });
    fireEvent.click(nextBtn);
    expect(window.location.search).toContain('photo=white-sands-horizon');

    // Click Previous capture chevron
    const prevBtn = within(dialog).getByRole('button', { name: /previous capture/i });
    fireEvent.click(prevBtn);
    expect(window.location.search).toContain('photo=brutalist-atrium-01');
  });

  it('navigates photos via keyboard ArrowRight and ArrowLeft keys', () => {
    window.history.replaceState({}, '', '/?photo=brutalist-atrium-01');
    render(<App />);

    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    expect(dialog).toHaveAttribute('open');

    // ArrowRight advances to white-sands-horizon
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(window.location.search).toContain('photo=white-sands-horizon');
    expect(within(dialog).getByRole('heading', { level: 2, name: /gypsum dune shadow line/i })).toBeInTheDocument();

    // ArrowLeft retreats to brutalist-atrium-01
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(window.location.search).toContain('photo=brutalist-atrium-01');
    expect(within(dialog).getByRole('heading', { level: 2, name: /brutalist concrete atrium/i })).toBeInTheDocument();
  });

  it('does not trigger photo navigation on arrow keys when typing inside an input element', () => {
    window.history.replaceState({}, '', '/?photo=brutalist-atrium-01');
    render(<App />);

    const testInput = document.createElement('input');
    document.body.appendChild(testInput);
    testInput.focus();

    // Dispatch ArrowRight targeted at the input element
    fireEvent.keyDown(testInput, { key: 'ArrowRight' });

    // Should NOT have navigated away from brutalist-atrium-01
    expect(window.location.search).toContain('photo=brutalist-atrium-01');
    document.body.removeChild(testInput);
  });

  it('closes dialog via Escape key and removes ?photo from URL search params', () => {
    window.history.replaceState({}, '', '/?photo=brutalist-atrium-01');
    render(<App />);

    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    expect(dialog).toHaveAttribute('open');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(window.location.search).toBe('');
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('closes dialog via Close (X) button and Done button', () => {
    window.history.replaceState({}, '', '/?photo=brutalist-atrium-01');
    render(<App />);

    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    const closeBtn = within(dialog).getByRole('button', { name: /close lightbox/i });
    fireEvent.click(closeBtn);

    expect(window.location.search).toBe('');
    expect(dialog.hasAttribute('open')).toBe(false);

    // Reopen via photo click in gallery and test Done button
    const photoBtn = screen.getByRole('button', {
      name: /inspect brutalist concrete atrium/i,
    });
    fireEvent.click(photoBtn);
    expect(dialog.hasAttribute('open')).toBe(true);

    const doneBtn = within(dialog).getByRole('button', { name: /^done$/i });
    fireEvent.click(doneBtn);

    expect(window.location.search).toBe('');
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('handles coordinate-boundary backdrop clicks: click inside stays open, click outside closes', () => {
    window.history.replaceState({}, '', '/?photo=brutalist-atrium-01');
    render(<App />);

    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    expect(dialog).toHaveAttribute('open');

    // Mock bounding rect [100, 100, 800, 600] -> right: 900, bottom: 700
    dialog.getBoundingClientRect = () =>
      ({
        top: 100,
        left: 100,
        width: 800,
        height: 600,
        right: 900,
        bottom: 700,
        x: 100,
        y: 100,
        toJSON: () => {},
      }) as DOMRect;

    // 1. Click INSIDE dialog coordinates (300, 300) -> stays open
    fireEvent.click(dialog, { clientX: 300, clientY: 300 });
    expect(window.location.search).toContain('photo=brutalist-atrium-01');
    expect(dialog.hasAttribute('open')).toBe(true);

    // 2. Click OUTSIDE dialog coordinates on backdrop (20, 20) -> closes
    fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    expect(window.location.search).toBe('');
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('copies permalink to clipboard and updates visual confirmation status', async () => {
    window.history.replaceState({}, '', '/?photo=brutalist-atrium-01');
    render(<App />);

    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    const copyBtn = within(dialog).getByRole('button', { name: /copy share link/i });

    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('?photo=brutalist-atrium-01')
    );

    await waitFor(() => {
      expect(within(dialog).getByText(/share link copied/i)).toBeInTheDocument();
    });

    // Navigating to next photo resets copied state
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(within(dialog).getByRole('button', { name: /copy share link/i })).toBeInTheDocument();
  });

  it('filters gallery by camera from Lightbox EXIF drawer shortcut', () => {
    window.history.replaceState({}, '', '/?photo=brutalist-atrium-01');
    render(<App />);

    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    const filterCameraBtn = within(dialog).getByRole('button', { name: /filter by camera/i });
    fireEvent.click(filterCameraBtn);

    // Dialog closes
    expect(dialog.hasAttribute('open')).toBe(false);

    // Gallery is filtered by Leica Q2
    expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
    expect(screen.getByText('Night market steam & neon')).toBeInTheDocument();
    expect(screen.queryByText('Shibuya rain reflections')).not.toBeInTheDocument();
  });
});
