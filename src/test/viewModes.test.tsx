/**
 * src/test/viewModes.test.tsx
 *
 * View Modes & Layout Architecture Tests:
 * - View Mode 1: Aspect-ratio Masonry Grid (CSS columns, natural aspect ratio, telemetry)
 * - View Mode 2: Uniform Square Grid (1:1 contact sheet frames, frame numbers, hover overlay badge)
 * - View Mode 3: Editorial List (divided rows, 240px thumbnail, 65ch story, EXIF formatters)
 * - Modern Web Guidance: optimize-image-priority rules across all 3 modes
 * - Dynamic LCP priority updates upon active filter mutations
 * - Segmented layout switcher button aria-pressed states
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';

describe('Gallery View Modes — Layout Structures & LCP Image Priority', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('renders Masonry Grid layout with CSS columns, aspect-ratio containers, and card telemetry', () => {
    render(<App />);

    const masonryBtn = screen.getByRole('button', { name: /aspect-ratio masonry grid/i });
    expect(masonryBtn).toHaveAttribute('aria-pressed', 'true');

    const masonryGrid = screen.getByTestId('gallery-masonry-grid');
    expect(masonryGrid).toHaveClass('columns-1', 'gap-6', 'sm:columns-2', 'lg:columns-3');

    // Verify card structure
    const articles = within(masonryGrid).getAllByRole('article');
    expect(articles.length).toBe(8);
    expect(articles[0]).toHaveClass('break-inside-avoid');

    // Inspect card elements
    expect(within(articles[0]).getByRole('heading', { level: 3 })).toBeInTheDocument();
    expect(within(articles[0]).getByText('minimalism', { selector: 'span' })).toBeInTheDocument();
  });

  it('switches to Uniform Square Grid and asserts 1:1 contact sheet frame layout with hover overlay badge', () => {
    render(<App />);

    const squareBtn = screen.getByRole('button', { name: /uniform square grid/i });
    fireEvent.click(squareBtn);
    expect(squareBtn).toHaveAttribute('aria-pressed', 'true');

    const squareGrid = screen.getByTestId('gallery-square-grid');
    expect(squareGrid).toHaveClass('grid', 'grid-cols-1', 'gap-6', 'sm:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4');

    // Verify contact sheet frame header
    expect(within(squareGrid).getByText('FRAME #01')).toBeInTheDocument();
    expect(within(squareGrid).getByText('FRAME #02')).toBeInTheDocument();

    // Verify square aspect ratio container on images
    const squareContainer = squareGrid.querySelector('.aspect-square');
    expect(squareContainer).not.toBeNull();

    // Verify contact sheet hover overlay badge with "Inspect frame" text
    expect(within(squareGrid).getAllByText(/inspect frame/i).length).toBe(8);
  });

  it('switches to Editorial List and asserts divided row layout with 65ch story and complete EXIF telemetry bar', () => {
    render(<App />);

    const editorialBtn = screen.getByRole('button', { name: /editorial list/i });
    fireEvent.click(editorialBtn);
    expect(editorialBtn).toHaveAttribute('aria-pressed', 'true');

    const editorialList = screen.getByTestId('gallery-editorial-list');
    expect(editorialList).toHaveClass('divide-y', 'divide-slate-200');

    // Verify thumbnail button with 240px width container on sm viewports (Mist over Lake Biwa is 1st in featured)
    const thumbnailBtn = within(editorialList).getByRole('button', {
      name: /inspect mist over lake biwa/i,
    });
    expect(thumbnailBtn).toHaveClass('sm:w-60', 'aspect-3/2');

    // Verify story measure
    const storyPara = editorialList.querySelector('p.max-w-\\[65ch\\]');
    expect(storyPara).not.toBeNull();
    expect(storyPara).toHaveTextContent(/water surface into pale silk|mist/i);

    // Verify tags
    expect(within(editorialList).getByText('#mist')).toBeInTheDocument();
    expect(within(editorialList).getByText('#japan')).toBeInTheDocument();

    // Verify telemetry bar on first article
    const articles = within(editorialList).getAllByRole('article');
    expect(within(articles[0]).getByText('Hasselblad 907X 50C')).toBeInTheDocument();
    expect(within(articles[0]).getByText('XCD 45mm f/4 P')).toBeInTheDocument();
    expect(within(articles[0]).getByText('3840×2160')).toBeInTheDocument();
    expect(within(articles[0]).getByText('45mm')).toBeInTheDocument();
    expect(within(articles[0]).getByText('f/8')).toBeInTheDocument();
    expect(within(articles[0]).getByText('1/4s')).toBeInTheDocument();
    expect(within(articles[0]).getByText('ISO 100')).toBeInTheDocument();
  });

  it('enforces optimize-image-priority rules across all 3 gallery view modes (Masonry, Square, Editorial)', () => {
    render(<App />);

    // 1. Masonry Grid (Default)
    const masonryGrid = screen.getByTestId('gallery-masonry-grid');
    const masonryImages = within(masonryGrid).getAllByRole('img');
    expect(masonryImages.length).toBeGreaterThan(1);
    expect(masonryImages[0]).toHaveAttribute('fetchpriority', 'high');
    expect(masonryImages[0]).not.toHaveAttribute('loading', 'lazy');
    for (let i = 1; i < masonryImages.length; i++) {
      expect(masonryImages[i]).toHaveAttribute('loading', 'lazy');
      expect(masonryImages[i]).not.toHaveAttribute('fetchpriority');
    }

    // 2. Uniform Square Grid
    const squareBtn = screen.getByRole('button', { name: /uniform square grid/i });
    fireEvent.click(squareBtn);
    const squareGrid = screen.getByTestId('gallery-square-grid');
    const squareImages = within(squareGrid).getAllByRole('img');
    expect(squareImages[0]).toHaveAttribute('fetchpriority', 'high');
    expect(squareImages[0]).not.toHaveAttribute('loading', 'lazy');
    expect(squareImages[1]).toHaveAttribute('loading', 'lazy');
    expect(squareImages[1]).not.toHaveAttribute('fetchpriority');

    // 3. Editorial List
    const editorialBtn = screen.getByRole('button', { name: /editorial list/i });
    fireEvent.click(editorialBtn);
    const editorialList = screen.getByTestId('gallery-editorial-list');
    const editorialImages = within(editorialList).getAllByRole('img');
    expect(editorialImages[0]).toHaveAttribute('fetchpriority', 'high');
    expect(editorialImages[0]).not.toHaveAttribute('loading', 'lazy');
    expect(editorialImages[1]).toHaveAttribute('loading', 'lazy');
    expect(editorialImages[1]).not.toHaveAttribute('fetchpriority');
  });

  it('dynamically preserves LCP candidate priority on 1st image after filter updates', () => {
    render(<App />);

    // Filter to street
    const streetPill = screen.getByRole('button', { name: /nocturnal street & transit/i });
    fireEvent.click(streetPill);

    const masonryGrid = screen.getByTestId('gallery-masonry-grid');
    const images = within(masonryGrid).getAllByRole('img');
    expect(images.length).toBe(2);

    // The new 1st image is dynamically assigned high priority
    expect(images[0]).toHaveAttribute('fetchpriority', 'high');
    expect(images[0]).not.toHaveAttribute('loading', 'lazy');

    // The 2nd image uses lazy loading
    expect(images[1]).toHaveAttribute('loading', 'lazy');
    expect(images[1]).not.toHaveAttribute('fetchpriority');
  });
});
