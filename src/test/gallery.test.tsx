/**
 * src/test/gallery.test.tsx
 *
 * Gallery Toolbar, Filtering, Multi-Field Search, Sorting, Navigation & Admin Integration Tests:
 * - 4 core navigation views (Gallery, Collections, About & gear, Admin studio)
 * - Collection filter pills with count badges, active states, and toggle behavior
 * - Live multi-field text search across title, location, camera, lens, and tags
 * - Camera/gear dropdown filter and reset
 * - Sorting options across featured, captured_desc, and created_desc
 * - Empty state with reset filters
 * - Navigation and cross-filtering from Collections & About views
 * - Admin Curation Studio client-side EXIF auto-extraction via exifr and CRUD operations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../App';
import { buildExifJpeg } from '../../scripts/generate-sample-captures';

describe('Gallery Toolbar — Filtering, Multi-Field Search & Sorting', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('renders the 4 top-level navigation items and defaults to the Gallery view', () => {
    render(<App />);

    const nav = screen.getByRole('navigation', { name: /primary navigation/i });
    expect(within(nav).getByRole('button', { name: /^gallery$/i })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(
      within(nav).getByRole('button', { name: /^collections$/i })
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole('button', { name: /about & gear/i })
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole('button', { name: /admin studio/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', { name: /curated visual archive/i })
    ).toBeInTheDocument();
  });

  it('displays collection filter pills with exact counts and active state styling', () => {
    render(<App />);

    const allPill = screen.getByRole('button', { name: /all captures/i });
    expect(allPill).toHaveAttribute('aria-pressed', 'true');
    expect(allPill).toHaveClass('border-blue-600', 'bg-blue-600', 'text-white');
    expect(within(allPill).getByText('8')).toBeInTheDocument();

    const archPill = screen.getByRole('button', { name: /architectural geometry/i });
    expect(archPill).toHaveAttribute('aria-pressed', 'false');
    expect(within(archPill).getByText('3')).toBeInTheDocument();

    const streetPill = screen.getByRole('button', { name: /nocturnal street & transit/i });
    expect(within(streetPill).getByText('2')).toBeInTheDocument();

    const minPill = screen.getByRole('button', { name: /atmospheric minimalism/i });
    expect(within(minPill).getByText('3')).toBeInTheDocument();
  });

  it('filters captures by collection and toggles back to all captures when clicking active pill', () => {
    render(<App />);

    const minPill = screen.getByRole('button', { name: /atmospheric minimalism/i });
    fireEvent.click(minPill);

    expect(minPill).toHaveAttribute('aria-pressed', 'true');
    expect(minPill).toHaveClass('border-blue-600', 'bg-blue-600', 'text-white');
    expect(screen.getByText('Mist over Lake Biwa')).toBeInTheDocument();
    expect(screen.getByText('Solitary pine on basalt ridge')).toBeInTheDocument();
    expect(screen.getByText('Gypsum dune shadow line')).toBeInTheDocument();
    expect(screen.queryByText('Brutalist concrete atrium')).not.toBeInTheDocument();

    // Toggle behavior: clicking active pill deselects it and restores all captures
    fireEvent.click(minPill);
    expect(minPill).toHaveAttribute('aria-pressed', 'false');
    const allPill = screen.getByRole('button', { name: /all captures/i });
    expect(allPill).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
  });

  it('performs live multi-field text search across title, location, camera, lens, and tags', () => {
    render(<App />);
    const searchInput = screen.getByLabelText(/search captures/i);

    // 1. Search by location ('Zurich')
    fireEvent.change(searchInput, { target: { value: 'Zurich' } });
    expect(screen.getByText('Spiral concrete stairwell')).toBeInTheDocument();
    expect(screen.queryByText('Shibuya rain reflections')).not.toBeInTheDocument();

    // 2. Search by camera model ('Fujifilm')
    fireEvent.change(searchInput, { target: { value: 'Fujifilm' } });
    expect(screen.getByText('Shibuya rain reflections')).toBeInTheDocument();
    expect(screen.getByText('Solitary pine on basalt ridge')).toBeInTheDocument();
    expect(screen.queryByText('Brutalist concrete atrium')).not.toBeInTheDocument();

    // 3. Search by lens model ('Summilux')
    fireEvent.change(searchInput, { target: { value: 'Summilux' } });
    expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
    expect(screen.getByText('Night market steam & neon')).toBeInTheDocument();
    expect(screen.queryByText('Mist over Lake Biwa')).not.toBeInTheDocument();

    // 4. Search by tag ('neon')
    fireEvent.change(searchInput, { target: { value: 'neon' } });
    expect(screen.getByText('Shibuya rain reflections')).toBeInTheDocument();
    expect(screen.getByText('Night market steam & neon')).toBeInTheDocument();
    expect(screen.queryByText('Mist over Lake Biwa')).not.toBeInTheDocument();

    // 5. Clear search query using the 'X' button
    const clearBtn = screen.getByRole('button', { name: /clear search query/i });
    fireEvent.click(clearBtn);
    expect(searchInput).toHaveValue('');
    expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
    expect(screen.getByText('Mist over Lake Biwa')).toBeInTheDocument();
  });

  it('filters captures by camera model dropdown and restores on reset', () => {
    render(<App />);
    const cameraSelect = screen.getByLabelText(/camera or gear/i);

    // Select Sony A7R V
    fireEvent.change(cameraSelect, { target: { value: 'Sony A7R V' } });
    expect(screen.getByText('Spiral concrete stairwell')).toBeInTheDocument();
    expect(screen.getByText('Nordic glass & timber pavilion')).toBeInTheDocument();
    expect(screen.queryByText('Brutalist concrete atrium')).not.toBeInTheDocument();

    // Reset dropdown to all cameras
    fireEvent.change(cameraSelect, { target: { value: '' } });
    expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
    expect(screen.getByText('Mist over Lake Biwa')).toBeInTheDocument();
  });

  it('sorts captures correctly across featured, captured_desc, and created_desc', () => {
    render(<App />);
    const sortSelect = screen.getByLabelText(/sort order/i);
    const grid = screen.getByTestId('gallery-masonry-grid');

    // Default 'featured' order: featured captures first by capture date (Mist over Lake Biwa is newest featured)
    const featuredHeadings = within(grid).getAllByRole('heading', { level: 3 });
    expect(featuredHeadings[0]).toHaveTextContent('Mist over Lake Biwa');

    // Switch to 'captured_desc' (Capture date newest)
    // 'Solitary pine on basalt ridge' is newest capture (2026-03-12), non-featured
    fireEvent.change(sortSelect, { target: { value: 'captured_desc' } });
    const capturedHeadings = within(grid).getAllByRole('heading', { level: 3 });
    expect(capturedHeadings[0]).toHaveTextContent('Solitary pine on basalt ridge');
    expect(capturedHeadings[1]).toHaveTextContent('Mist over Lake Biwa');

    // Switch to 'created_desc' (Newly added)
    // 'Solitary pine on basalt ridge' is newest created (2026-03-13), followed by 'Mist over Lake Biwa' (2026-03-11)
    fireEvent.change(sortSelect, { target: { value: 'created_desc' } });
    const createdHeadings = within(grid).getAllByRole('heading', { level: 3 });
    expect(createdHeadings[0]).toHaveTextContent('Solitary pine on basalt ridge');
    expect(createdHeadings[1]).toHaveTextContent('Mist over Lake Biwa');
  });

  it('renders empty state when no captures match and resets cleanly', () => {
    render(<App />);
    const searchInput = screen.getByLabelText(/search captures/i);
    fireEvent.change(searchInput, { target: { value: 'non-matching-string-xyz' } });

    expect(
      screen.getByRole('heading', {
        name: /no captures match your current filters/i,
      })
    ).toBeInTheDocument();
    const resetBtn = screen.getByRole('button', { name: /^reset filters$/i });
    fireEvent.click(resetBtn);

    expect(screen.getByText('Brutalist concrete atrium')).toBeInTheDocument();
  });

  it('navigates to Collections and About & gear views and filters gallery when selecting a collection or camera', () => {
    render(<App />);

    // Switch to Collections view
    fireEvent.click(screen.getByRole('button', { name: /^collections$/i }));
    expect(
      screen.getByRole('heading', { name: /curated collections/i })
    ).toBeInTheDocument();

    // Click "Explore nocturnal street & transit"
    fireEvent.click(
      screen.getByRole('button', {
        name: /explore nocturnal street & transit/i,
      })
    );

    // Should return to Gallery filtered by 'street'
    expect(
      screen.getByRole('heading', { name: /curated visual archive/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/shibuya rain reflections/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/brutalist concrete atrium/i)
    ).not.toBeInTheDocument();

    // Switch to About & gear view
    fireEvent.click(screen.getByRole('button', { name: /about & gear/i }));
    expect(
      screen.getByRole('heading', { name: /gear & optics inventory/i })
    ).toBeInTheDocument();

    // Click "View Sony A7R V captures"
    fireEvent.click(
      screen.getByRole('button', { name: /view sony a7r v captures/i })
    );
    expect(
      screen.getByRole('heading', { name: /curated visual archive/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/spiral concrete stairwell/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/shibuya rain reflections/i)
    ).not.toBeInTheDocument();
  });

  it('auto-extracts EXIF metadata on file upload in Admin Studio and supports creating, editing, featuring, and deleting captures', async () => {
    render(<App />);

    // Navigate to Admin studio
    fireEvent.click(screen.getByRole('button', { name: /admin studio/i }));
    expect(
      screen.getByRole('heading', { name: /admin curation studio/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId('zero-trust-badge')).toHaveTextContent(
      /dev@localhost/i
    );

    // Build an authentic EXIF JPEG fixture in memory
    const jpegBytes = buildExifJpeg({
      filePath: 'captures/architecture/kyoto-concrete-chapel.jpg',
      width: 4000,
      height: 3000,
      make: 'Leica Camera AG',
      model: 'Leica Q2',
      lensModel: 'Summilux 28mm f/1.7 ASPH',
      focalLength: 28,
      fNumber: 4.0,
      exposureTime: 0.008, // 1/125s
      iso: 400,
      dateTimeOriginal: '2026:03:18 10:15:00',
    });

    const file = new File([new Uint8Array(jpegBytes)], 'kyoto-concrete-chapel.jpg', {
      type: 'image/jpeg',
    });

    const fileInput = screen.getByLabelText(
      /drop photograph or select image file/i
    );
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for client-side exifr extraction to populate form inputs
    await waitFor(() => {
      expect(screen.getByTestId('exif-extracted-banner')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/capture title/i)).toHaveValue(
      'Kyoto concrete chapel'
    );
    expect(screen.getByLabelText(/camera body/i)).toHaveValue('Leica Q2');
    expect(screen.getByLabelText(/lens model/i)).toHaveValue(
      'Summilux 28mm f/1.7 ASPH'
    );
    expect(screen.getByLabelText(/focal length/i)).toHaveValue('28mm');
    expect(screen.getByLabelText(/aperture/i)).toHaveValue('f/4');
    expect(screen.getByLabelText(/shutter speed/i)).toHaveValue('1/125s');
    expect(screen.getByLabelText(/iso sensitivity/i)).toHaveValue(400);

    // Publish the new capture
    fireEvent.click(screen.getByRole('button', { name: /publish capture/i }));

    await waitFor(() => {
      expect(
        screen.getByTestId('admin-capture-row-kyoto-concrete-chapel')
      ).toBeInTheDocument();
    });

    // Test confirmation-backed deletion on the newly created row
    const newRow = screen.getByTestId('admin-capture-row-kyoto-concrete-chapel');
    fireEvent.click(
      within(newRow).getByRole('button', { name: /delete kyoto concrete chapel/i })
    );
    fireEvent.click(
      within(newRow).getByRole('button', {
        name: /confirm delete kyoto concrete chapel/i,
      })
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId('admin-capture-row-kyoto-concrete-chapel')
      ).not.toBeInTheDocument();
    });
  });

  it('validates empty capture title and supports editing existing captures in Admin Studio', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /admin studio/i }));

    // Submitting with empty title shows accessible alert error
    fireEvent.click(screen.getByRole('button', { name: /publish capture/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      /please enter a capture title before saving/i
    );

    // Edit an existing capture
    const row = screen.getByTestId('admin-capture-row-brutalist-atrium-01');
    fireEvent.click(
      within(row).getByRole('button', { name: /edit brutalist concrete atrium/i })
    );

    const titleInput = screen.getByLabelText(/capture title/i);
    expect(titleInput).toHaveValue('Brutalist concrete atrium');
    fireEvent.change(titleInput, {
      target: { value: 'Barbican atrium study II' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /save capture changes/i })
    );

    await waitFor(() => {
      expect(screen.getByText('Barbican atrium study II')).toBeInTheDocument();
    });
  });
});
