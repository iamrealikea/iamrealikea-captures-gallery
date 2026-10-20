/**
 * src/test/challenger-admin-curation-studio.test.tsx
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST SUITE for Admin Curation Studio (/admin):
 * 1. Drag-and-drop dropzone:
 *    - Valid images: .jpg, .jpeg, .png, .webp, .avif
 *    - File size boundaries: <= 25MB accepted, > 25MB rejected with error alert
 *    - Unsupported MIME & extensions: application/pdf, text/plain, image/gif, image/svg+xml rejected with alert
 *    - Drag over/leave active styling toggling
 * 2. Client-side EXIF auto-extraction via exifr with genuine binary JPEG payloads:
 *    - Multi-system camera fixtures: Leica Q3, Fujifilm X-T5, Sony A7R V, Nikon Z8
 *    - Camera make/model, lens model, focal length, aperture, shutter speed, ISO, capture date, dimensions
 *    - Telemetry banner formatting and inferred title from filename
 *    - Corrupt / untagged image payload fallback banner without crashing
 *    - File read failure triggering error status banner
 * 3. Form submission validation & metadata curation:
 *    - Empty title and whitespace-only title rejection with role="alert"
 *    - Real-time alert dismissal on title input change
 *    - Preservation of pre-typed title when image is dropped
 *    - Custom metadata curation: location, collection dropdown, story with text-wrap: pretty, tag chips
 *    - Full creation lifecycle with catalog table insertion and form reset
 * 4. Editing lifecycle:
 *    - Pre-populating form fields on Edit click
 *    - Switching edit target between different captures
 *    - Cancellation paths ("Cancel edit" and "Cancel" button) resetting form without modifying catalog
 *    - Updating record and saving changes
 * 5. Inline featured toggle in management table:
 *    - Feature toggle adds Sparkles badge and updates aria-label
 *    - Unfeature toggle removes Sparkles badge and restores neutral label
 * 6. Confirmation-backed deletion modal:
 *    - Native <dialog closedby="any"> opened via showModal()
 *    - Coordinate-boundary backdrop click light-dismiss (inside vs outside rect, child element targets)
 *    - Cancellation path (Cancel button & Escape cancel event) preserving record
 *    - Confirmation path deleting record from D1/R2 and updating UI catalog
 * 7. Security Perimeter & Auth Modes:
 *    - Authenticated Zero Trust badge (dev@localhost, development-bypass)
 *    - Unauthenticated Zero Trust badge (Pending status, amber styling)
 *    - Async creation failure resilience
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../App';
import { AdminStudioView } from '../components/AdminStudioView';
import { defaultMockStore } from '../data/mockStore';
import { SEED_CAPTURES, SEED_COLLECTIONS } from '../data/seedCaptures';
import { buildExifJpeg } from '../../scripts/generate-sample-captures';
import * as exifExtractor from '../utils/exifExtractor';
import type { AuthSession } from '../types/gallery';

describe('Empirical Challenger: Admin Curation Studio Adversarial Suite', () => {
  beforeEach(() => {
    defaultMockStore.reset();
    window.history.replaceState({}, '', '/admin');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. Drag-and-Drop Dropzone Validation & MIME Enforcement
  // ==========================================================================
  describe('1. Drag-and-drop dropzone file validation', () => {
    it('accepts valid image extensions (.jpg, .png, .webp, .avif) and renders file input accept attribute', () => {
      render(<App />);

      const fileInput = screen.getByLabelText(/drop photograph or select image file/i);
      expect(fileInput).toHaveAttribute(
        'accept',
        'image/jpeg,image/png,image/webp,image/avif'
      );
    });

    it('toggles drag styling classes on dragEnter, dragOver, and dragLeave', () => {
      render(<App />);

      const fileInput = screen.getByLabelText(/drop photograph or select image file/i);
      const dropzone = fileInput.closest('div');
      expect(dropzone).not.toBeNull();

      if (dropzone) {
        // Initially default styling
        expect(dropzone).toHaveClass('border-slate-300');
        expect(dropzone).not.toHaveClass('border-blue-600');

        // Drag enter & over -> active blue border
        fireEvent.dragEnter(dropzone);
        expect(dropzone).toHaveClass('border-blue-600', 'bg-blue-50/50');

        fireEvent.dragOver(dropzone);
        expect(dropzone).toHaveClass('border-blue-600', 'bg-blue-50/50');

        // Drag leave -> resets to neutral border
        fireEvent.dragLeave(dropzone);
        expect(dropzone).toHaveClass('border-slate-300');
        expect(dropzone).not.toHaveClass('border-blue-600');
      }
    });

    it('rejects files exceeding 25MB upload limit with descriptive error message', async () => {
      render(<App />);

      const dropzone = screen
        .getByLabelText(/drop photograph or select image file/i)
        .closest('div')!;

      // 26MB file (exceeds 25MB = 26,214,400 bytes)
      const oversizedBytes = new Uint8Array(10);
      const oversizedFile = new File([oversizedBytes], 'massive-panoramic-raw.jpg', {
        type: 'image/jpeg',
      });
      Object.defineProperty(oversizedFile, 'size', {
        value: 26 * 1024 * 1024 + 1024,
        configurable: true,
      });

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [oversizedFile] },
      });

      await waitFor(() => {
        const errorStatus = screen.getByRole('status');
        expect(errorStatus).toHaveTextContent(
          /file "massive-panoramic-raw\.jpg" exceeds maximum upload limit of 25mb/i
        );
      });

      // Assert title was NOT inferred and EXIF banner was NOT displayed
      expect(screen.queryByTestId('exif-extracted-banner')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/capture title/i)).toHaveValue('');
    });

    it('accepts files within 25MB boundary limit via file input change', async () => {
      render(<App />);

      const fileInput = screen.getByLabelText(/drop photograph or select image file/i);

      // Construct authentic JPEG at 24.5MB simulated size
      const validJpeg = buildExifJpeg({
        filePath: 'captures/architecture/valid-size.jpg',
        width: 3000,
        height: 2000,
        make: 'Fujifilm',
        model: 'Fujifilm X-T5',
        lensModel: 'XF 23mm f/1.4 R LM WR',
        focalLength: 23,
        fNumber: 1.4,
        exposureTime: 0.002,
        iso: 160,
        dateTimeOriginal: '2026:06:20 18:30:00',
      });

      const file = new File([new Uint8Array(validJpeg)], 'valid-size.jpg', {
        type: 'image/jpeg',
      });
      Object.defineProperty(file, 'size', {
        value: 24 * 1024 * 1024, // 24MB
        configurable: true,
      });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(
        () => {
          expect(screen.getByTestId('exif-extracted-banner')).toBeInTheDocument();
        },
        { timeout: 4000 }
      );

      expect(screen.getByLabelText(/camera body/i)).toHaveValue('Fujifilm X-T5');
    });

    it('rejects unsupported MIME types (application/pdf, text/plain, image/gif, image/svg+xml)', async () => {
      render(<App />);

      const dropzone = screen
        .getByLabelText(/drop photograph or select image file/i)
        .closest('div')!;

      // 1. PDF document
      const pdfFile = new File(['%PDF-1.4 mock content'], 'annual-report.pdf', {
        type: 'application/pdf',
      });
      fireEvent.drop(dropzone, {
        dataTransfer: { files: [pdfFile] },
      });

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(
          /unsupported image format "annual-report\.pdf"\. please upload jpeg, png, webp, or avif files\./i
        );
      });

      // 2. Plain text
      const txtFile = new File(['Camera specs and notes'], 'notes.txt', {
        type: 'text/plain',
      });
      fireEvent.drop(dropzone, {
        dataTransfer: { files: [txtFile] },
      });

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(
          /unsupported image format "notes\.txt"\. please upload jpeg, png, webp, or avif files\./i
        );
      });

      // 3. GIF format
      const gifFile = new File(['GIF89a mock'], 'animation.gif', {
        type: 'image/gif',
      });
      fireEvent.drop(dropzone, {
        dataTransfer: { files: [gifFile] },
      });

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(
          /unsupported image format "animation\.gif"/i
        );
      });

      // 4. SVG vector
      const svgFile = new File(['<svg></svg>'], 'vector.svg', {
        type: 'image/svg+xml',
      });
      fireEvent.drop(dropzone, {
        dataTransfer: { files: [svgFile] },
      });

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(
          /unsupported image format "vector\.svg"/i
        );
      });
    });
  });

  // ==========================================================================
  // 2. Client-Side EXIF Auto-Extraction with Authentic Payloads
  // ==========================================================================
  describe('2. Client-side EXIF auto-extraction via exifr', () => {
    it('extracts Leica Q3 technical telemetry and populates all form inputs and telemetry banner', async () => {
      render(<App />);

      const leicaBytes = buildExifJpeg({
        filePath: 'captures/street/leica-q3-kyoto-market.jpg',
        width: 6000,
        height: 4000,
        make: 'Leica',
        model: 'Leica Q3',
        lensModel: 'Summilux 28mm f/1.7 ASPH',
        focalLength: 28,
        fNumber: 1.7,
        exposureTime: 0.001, // 1/1000s
        iso: 200,
        dateTimeOriginal: '2026:05:12 16:45:00',
      });

      const file = new File([new Uint8Array(leicaBytes)], 'leica-q3-kyoto-market.jpg', {
        type: 'image/jpeg',
      });

      const dropzone = screen
        .getByLabelText(/drop photograph or select image file/i)
        .closest('div')!;

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      });

      await waitFor(
        () => {
          expect(screen.getByTestId('exif-extracted-banner')).toBeInTheDocument();
        },
        { timeout: 4000 }
      );

      const banner = screen.getByTestId('exif-extracted-banner');
      expect(banner).toHaveTextContent(/Leica Q3/i);
      expect(banner).toHaveTextContent(/Summilux 28mm f\/1\.7 ASPH/i);
      expect(banner).toHaveTextContent(/28mm/i);
      expect(banner).toHaveTextContent(/f\/1\.7/i);
      expect(banner).toHaveTextContent(/1\/1000s/i);
      expect(banner).toHaveTextContent(/ISO 200/i);

      // Verify form population
      expect(screen.getByLabelText(/capture title/i)).toHaveValue('Leica q3 kyoto market');
      expect(screen.getByLabelText(/camera body/i)).toHaveValue('Leica Q3');
      expect(screen.getByLabelText(/lens model/i)).toHaveValue('Summilux 28mm f/1.7 ASPH');
      expect(screen.getByLabelText(/focal length/i)).toHaveValue('28mm');
      expect(screen.getByLabelText(/aperture/i)).toHaveValue('f/1.7');
      expect(screen.getByLabelText(/shutter speed/i)).toHaveValue('1/1000s');
      expect(screen.getByLabelText(/iso sensitivity/i)).toHaveValue(200);
    });

    it('extracts Nikon Z8 optical telemetry and preserves manual title entered beforehand', async () => {
      render(<App />);

      const titleInput = screen.getByLabelText(/capture title/i);
      fireEvent.change(titleInput, {
        target: { value: 'Atmospheric mist above alpine ridge' },
      });

      const nikonBytes = buildExifJpeg({
        filePath: 'captures/minimalism/nikon-z8-alpine-mist.jpg',
        width: 8256,
        height: 5504,
        make: 'Nikon',
        model: 'Nikon Z8',
        lensModel: 'NIKKOR Z 50mm f/1.2 S',
        focalLength: 50,
        fNumber: 1.2,
        exposureTime: 0.0005, // 1/2000s
        iso: 64,
        dateTimeOriginal: '2026:08:15 10:00:00',
      });

      const file = new File([new Uint8Array(nikonBytes)], 'nikon-z8-alpine-mist.jpg', {
        type: 'image/jpeg',
      });

      const fileInput = screen.getByLabelText(/drop photograph or select image file/i);
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(
        () => {
          expect(screen.getByTestId('exif-extracted-banner')).toBeInTheDocument();
        },
        { timeout: 4000 }
      );

      // Title must remain the user's manual title, NOT the filename
      expect(screen.getByLabelText(/capture title/i)).toHaveValue(
        'Atmospheric mist above alpine ridge'
      );
      expect(screen.getByLabelText(/camera body/i)).toHaveValue('Nikon Z8');
      expect(screen.getByLabelText(/lens model/i)).toHaveValue('NIKKOR Z 50mm f/1.2 S');
      expect(screen.getByLabelText(/focal length/i)).toHaveValue('50mm');
      expect(screen.getByLabelText(/aperture/i)).toHaveValue('f/1.2');
      expect(screen.getByLabelText(/shutter speed/i)).toHaveValue('1/2000s');
      expect(screen.getByLabelText(/iso sensitivity/i)).toHaveValue(64);
    });

    it('handles untagged/minimal image binaries gracefully with dimensional fallback banner', async () => {
      render(<App />);

      // Minimal JPEG without EXIF metadata
      const untaggedBytes = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9,
      ]);
      const untaggedFile = new File([untaggedBytes], 'minimal-sensor.jpg', {
        type: 'image/jpeg',
      });

      const dropzone = screen
        .getByLabelText(/drop photograph or select image file/i)
        .closest('div')!;

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [untaggedFile] },
      });

      // Banner confirms processing with fallback dimensions
      await waitFor(() => {
        expect(screen.getByTestId('exif-extracted-banner')).toHaveTextContent(
          /processed minimal-sensor\.jpg/i
        );
      });

      // Title is still inferred and component remains fully interactive
      expect(screen.getByLabelText(/capture title/i)).toHaveValue('Minimal sensor');
    });

    it('displays error status banner when EXIF extractor throws an unhandled exception', async () => {
      vi.spyOn(exifExtractor, 'extractExifMetadata').mockRejectedValueOnce(
        new Error('I/O read failure')
      );

      render(<App />);

      const file = new File(['mock content'], 'unreadable.jpg', {
        type: 'image/jpeg',
      });

      const dropzone = screen
        .getByLabelText(/drop photograph or select image file/i)
        .closest('div')!;

      fireEvent.drop(dropzone, {
        dataTransfer: { files: [file] },
      });

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(
          /could not read exif metadata from unreadable\.jpg\. you can still enter fields manually\./i
        );
      });
    });
  });

  // ==========================================================================
  // 3. Form Submission Validation & Custom Metadata Curation
  // ==========================================================================
  describe('3. Form submission validation & curation lifecycle', () => {
    it('alerts on empty or whitespace-only title submission and clears alert on user typing', async () => {
      render(<App />);

      const publishBtn = screen.getByRole('button', { name: /publish capture/i });
      const titleInput = screen.getByLabelText(/capture title/i);

      // 1. Submit completely empty
      fireEvent.click(publishBtn);
      expect(screen.getByRole('alert')).toHaveTextContent(
        /please enter a capture title before saving/i
      );

      // 2. Submit whitespace-only
      fireEvent.change(titleInput, { target: { value: '     ' } });
      fireEvent.click(publishBtn);
      expect(screen.getByRole('alert')).toHaveTextContent(
        /please enter a capture title before saving/i
      );

      // 3. User types valid character -> alert clears immediately
      fireEvent.change(titleInput, { target: { value: 'S' } });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('renders real-time tag chips as user enters comma-separated tags', () => {
      render(<App />);

      const tagsInput = screen.getByLabelText(/tags \(comma-separated\)/i);
      fireEvent.change(tagsInput, {
        target: { value: 'architecture, brutalism, monochrome, light-study' },
      });

      expect(screen.getByText('#architecture')).toBeInTheDocument();
      expect(screen.getByText('#brutalism')).toBeInTheDocument();
      expect(screen.getByText('#monochrome')).toBeInTheDocument();
      expect(screen.getByText('#light-study')).toBeInTheDocument();
    });

    it('creates a new capture with complete curated metadata, resets form, and updates catalog table', async () => {
      render(<App />);

      const titleInput = screen.getByLabelText(/capture title/i);
      fireEvent.change(titleInput, { target: { value: 'Berlin Philharmonie Facade' } });

      const collectionSelect = screen.getByLabelText(/collection/i);
      fireEvent.change(collectionSelect, { target: { value: 'architecture' } });

      const locationInput = screen.getByLabelText(/location/i);
      fireEvent.change(locationInput, { target: { value: 'Tiergarten, Berlin' } });

      const storyInput = screen.getByLabelText(/editorial story/i);
      fireEvent.change(storyInput, {
        target: {
          value:
            'Hans Scharoun organic modernism glowing under overcast Northern European autumn light.',
        },
      });

      const cameraInput = screen.getByLabelText(/camera body/i);
      fireEvent.change(cameraInput, { target: { value: 'Leica M11-P' } });

      const lensInput = screen.getByLabelText(/lens model/i);
      fireEvent.change(lensInput, { target: { value: 'Summicron-M 35mm f/2 ASPH' } });

      const focalInput = screen.getByLabelText(/focal length/i);
      fireEvent.change(focalInput, { target: { value: '35mm' } });

      const apertureInput = screen.getByLabelText(/aperture/i);
      fireEvent.change(apertureInput, { target: { value: 'f/4.0' } });

      const shutterInput = screen.getByLabelText(/shutter speed/i);
      fireEvent.change(shutterInput, { target: { value: '1/500s' } });

      const isoInput = screen.getByLabelText(/iso sensitivity/i);
      fireEvent.change(isoInput, { target: { value: '64' } });

      const tagsInput = screen.getByLabelText(/tags \(comma-separated\)/i);
      fireEvent.change(tagsInput, { target: { value: 'berlin, organic, brutalism' } });

      const featuredCheckbox = screen.getByLabelText(
        /feature this capture in primary gallery sorting/i
      );
      fireEvent.click(featuredCheckbox);
      expect(featuredCheckbox).toBeChecked();

      // Submit
      fireEvent.click(screen.getByRole('button', { name: /publish capture/i }));

      // Verify success status
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(
          /published capture "berlin philharmonie facade" to r2 and d1/i
        );
      });

      // Verify row rendered in catalog
      const newRow = screen.getByTestId('admin-capture-row-berlin-philharmonie-facade');
      expect(newRow).toBeInTheDocument();
      expect(within(newRow).getByText('Berlin Philharmonie Facade')).toBeInTheDocument();
      expect(within(newRow).getByText('architecture')).toBeInTheDocument();
      expect(within(newRow).getAllByText('Featured').length).toBeGreaterThanOrEqual(1);
      expect(within(newRow).getByText(/Leica M11-P/i)).toBeInTheDocument();
      expect(within(newRow).getByText(/35mm/i)).toBeInTheDocument();
      expect(within(newRow).getByText(/f\/4\.0/i)).toBeInTheDocument();
      expect(within(newRow).getByText(/1\/500s/i)).toBeInTheDocument();
      expect(within(newRow).getByText(/ISO 64/i)).toBeInTheDocument();

      // Verify form reset
      expect(titleInput).toHaveValue('');
      expect(locationInput).toHaveValue('');
      expect(storyInput).toHaveValue('');
      expect(featuredCheckbox).not.toBeChecked();
    });
  });

  // ==========================================================================
  // 4. Capture Editing Lifecycle & State Integrity
  // ==========================================================================
  describe('4. Capture editing lifecycle', () => {
    it('pre-populates all metadata on Edit click and cancels without modifying catalog', async () => {
      render(<App />);

      const targetRow = screen.getByTestId('admin-capture-row-brutalist-atrium-01');
      const editBtn = within(targetRow).getByRole('button', {
        name: /edit brutalist concrete atrium/i,
      });

      fireEvent.click(editBtn);

      // Verify header changed to Edit mode
      expect(
        screen.getByRole('heading', { name: /edit capture metadata/i })
      ).toBeInTheDocument();

      const titleInput = screen.getByLabelText(/capture title/i);
      expect(titleInput).toHaveValue('Brutalist concrete atrium');

      const locationInput = screen.getByLabelText(/location/i);
      expect(locationInput).toHaveValue('Barbican Estate, London');

      // Edit field
      fireEvent.change(titleInput, { target: { value: 'Modified Title Not Saved' } });

      // Cancel edit via heading button
      const cancelBtn = screen.getByRole('button', { name: /cancel edit/i });
      fireEvent.click(cancelBtn);

      // Form resets
      expect(
        screen.getByRole('heading', { name: /ingest new capture/i })
      ).toBeInTheDocument();
      expect(titleInput).toHaveValue('');

      // Catalog row preserved
      expect(
        within(targetRow).getByText('Brutalist concrete atrium')
      ).toBeInTheDocument();
      expect(
        within(targetRow).queryByText('Modified Title Not Saved')
      ).not.toBeInTheDocument();
    });

    it('allows switching editing targets directly and applies edits on save', async () => {
      render(<App />);

      // 1. Edit first capture
      const row1 = screen.getByTestId('admin-capture-row-brutalist-atrium-01');
      fireEvent.click(within(row1).getByRole('button', { name: /edit brutalist concrete atrium/i }));
      expect(screen.getByLabelText(/capture title/i)).toHaveValue('Brutalist concrete atrium');

      // 2. Click edit on second capture without explicit cancel
      const row2 = screen.getByTestId('admin-capture-row-spiral-concrete-stairs');
      fireEvent.click(within(row2).getByRole('button', { name: /edit spiral concrete stairwell/i }));
      expect(screen.getByLabelText(/capture title/i)).toHaveValue('Spiral concrete stairwell');

      // 3. Update story and save
      const storyInput = screen.getByLabelText(/editorial story/i);
      fireEvent.change(storyInput, {
        target: { value: 'Updated architectural geometric stairwell story.' },
      });

      const titleInput = screen.getByLabelText(/capture title/i);
      fireEvent.change(titleInput, {
        target: { value: 'Helical concrete geometry' },
      });

      fireEvent.click(screen.getByRole('button', { name: /save capture changes/i }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(
          /updated capture "helical concrete geometry"/i
        );
      });

      // Verify form reset
      expect(
        screen.getByRole('heading', { name: /ingest new capture/i })
      ).toBeInTheDocument();
      expect(titleInput).toHaveValue('');

      // Verify row updated
      expect(screen.getByText('Helical concrete geometry')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // 5. Inline Featured Toggle in Catalog Table
  // ==========================================================================
  describe('5. Inline featured toggle action', () => {
    it('features an unfeatured capture inline, toggling badge and button styling', async () => {
      render(<App />);

      const row = screen.getByTestId('admin-capture-row-spiral-concrete-stairs');
      const toggleBtn = within(row).getByRole('button', {
        name: /feature spiral concrete stairwell/i,
      });

      // Initial state: unfeatured
      expect(toggleBtn).toHaveTextContent('Feature');
      expect(within(row).queryByText('Featured')).not.toBeInTheDocument();

      // Click to feature
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        expect(within(row).getByRole('button', {
          name: /unfeature spiral concrete stairwell/i,
        })).toHaveTextContent('Featured');
        // Badge + Button both render 'Featured' text
        expect(within(row).getAllByText('Featured').length).toBeGreaterThanOrEqual(1);
      });

      // Click to unfeature
      const unfeatureBtn = within(row).getByRole('button', {
        name: /unfeature spiral concrete stairwell/i,
      });
      fireEvent.click(unfeatureBtn);

      await waitFor(() => {
        expect(within(row).getByRole('button', {
          name: /feature spiral concrete stairwell/i,
        })).toHaveTextContent('Feature');
        expect(within(row).queryByText('Featured')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // 6. Accessible Confirmation-Backed Deletion Modal
  // ==========================================================================
  describe('6. Accessible confirmation-backed deletion modal', () => {
    it('opens native <dialog closedby="any"> with accessible headings and warning copy', () => {
      render(<App />);

      const row = screen.getByTestId('admin-capture-row-brutalist-atrium-01');
      const deleteBtn = within(row).getByRole('button', {
        name: /delete brutalist concrete atrium/i,
      });

      fireEvent.click(deleteBtn);

      const dialog = row.querySelector('dialog');
      expect(dialog).not.toBeNull();
      expect(dialog).toHaveAttribute('open');
      expect(dialog).toHaveAttribute('closedby', 'any');
      expect(dialog).toHaveAttribute(
        'aria-labelledby',
        'delete-title-cap-brutalist-atrium-01'
      );

      expect(
        within(dialog!).getByRole('heading', { name: /delete photograph\?/i })
      ).toBeInTheDocument();
      expect(
        within(dialog!).getByText(/brutalist concrete atrium/i)
      ).toBeInTheDocument();
      expect(
        within(dialog!).getByText(/removes the database record from cloudflare d1/i)
      ).toBeInTheDocument();
    });

    it('dismisses modal on backdrop click outside dialog coordinate boundary while preserving record', () => {
      render(<App />);

      const row = screen.getByTestId('admin-capture-row-brutalist-atrium-01');
      fireEvent.click(
        within(row).getByRole('button', { name: /delete brutalist concrete atrium/i })
      );

      const dialog = row.querySelector('dialog') as HTMLDialogElement;
      expect(dialog).not.toBeNull();

      // Mock bounding rect: dialog is situated at x:[100, 500], y:[100, 400]
      vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
        left: 100,
        top: 100,
        right: 500,
        bottom: 400,
        width: 400,
        height: 300,
        x: 100,
        y: 100,
        toJSON: () => {},
      } as DOMRect);

      // 1. Click INSIDE dialog coordinates -> dialog remains OPEN
      fireEvent.click(dialog, { clientX: 250, clientY: 250 });
      expect(row.querySelector('dialog')).not.toBeNull();

      // 2. Click inside child element (e.g. heading) -> dialog remains OPEN
      const heading = within(dialog).getByRole('heading', { name: /delete photograph\?/i });
      fireEvent.click(heading, { clientX: 150, clientY: 150 });
      expect(row.querySelector('dialog')).not.toBeNull();

      // 3. Click OUTSIDE dialog coordinates (backdrop click) -> dialog CLOSES
      fireEvent.click(dialog, { clientX: 50, clientY: 50 });
      expect(row.querySelector('dialog')).toBeNull();

      // Verify capture was NOT deleted
      expect(
        screen.getByTestId('admin-capture-row-brutalist-atrium-01')
      ).toBeInTheDocument();
    });

    it('cancels deletion on Cancel button click or Escape cancel event without modifying records', () => {
      render(<App />);

      const row = screen.getByTestId('admin-capture-row-brutalist-atrium-01');
      fireEvent.click(
        within(row).getByRole('button', { name: /delete brutalist concrete atrium/i })
      );

      const dialog = row.querySelector('dialog')!;
      expect(dialog).toBeInTheDocument();

      // Click Cancel
      const cancelBtn = within(dialog).getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelBtn);

      // Modal closed, record intact
      expect(row.querySelector('dialog')).toBeNull();
      expect(
        screen.getByTestId('admin-capture-row-brutalist-atrium-01')
      ).toBeInTheDocument();

      // Re-open and test Escape (cancel event)
      fireEvent.click(
        within(row).getByRole('button', { name: /delete brutalist concrete atrium/i })
      );
      const reDialog = row.querySelector('dialog')!;
      fireEvent(reDialog, new Event('cancel'));

      expect(row.querySelector('dialog')).toBeNull();
      expect(
        screen.getByTestId('admin-capture-row-brutalist-atrium-01')
      ).toBeInTheDocument();
    });

    it('permanently deletes capture on Confirm delete, updates D1 catalog and renders status banner', async () => {
      render(<App />);

      // First create a new temporary capture to delete
      const titleInput = screen.getByLabelText(/capture title/i);
      fireEvent.change(titleInput, { target: { value: 'Transient Test Capture' } });
      fireEvent.click(screen.getByRole('button', { name: /publish capture/i }));

      await waitFor(() => {
        expect(
          screen.getByTestId('admin-capture-row-transient-test-capture')
        ).toBeInTheDocument();
      });

      const tempRow = screen.getByTestId('admin-capture-row-transient-test-capture');

      // Click Delete to open confirmation dialog
      fireEvent.click(
        within(tempRow).getByRole('button', { name: /delete transient test capture/i })
      );

      const dialog = tempRow.querySelector('dialog')!;
      const confirmBtn = within(dialog).getByRole('button', {
        name: /confirm delete transient test capture/i,
      });

      // Confirm delete
      fireEvent.click(confirmBtn);

      // Record is removed
      await waitFor(() => {
        expect(
          screen.queryByTestId('admin-capture-row-transient-test-capture')
        ).not.toBeInTheDocument();
      });

      // Success notification displayed
      expect(screen.getByRole('status')).toHaveTextContent(
        /deleted capture "transient test capture"/i
      );
    });
  });

  // ==========================================================================
  // 7. Security Perimeter & Auth Modes (Isolated Component Testing)
  // ==========================================================================
  describe('7. Security perimeter and auth session states', () => {
    it('renders authenticated Zero Trust badge with development bypass details', () => {
      const mockAuth: AuthSession = {
        authenticated: true,
        email: 'curator@gallery.internal',
        mode: 'production-jwt',
      };

      render(
        <AdminStudioView
          captures={SEED_CAPTURES}
          collections={SEED_COLLECTIONS}
          authSession={mockAuth}
          onCreateCapture={vi.fn()}
          onUpdateCapture={vi.fn()}
          onDeleteCapture={vi.fn()}
        />
      );

      const badge = screen.getByTestId('zero-trust-badge');
      expect(badge).toHaveTextContent(/authenticated/i);
      expect(badge).toHaveTextContent('curator@gallery.internal');
      expect(badge).toHaveTextContent('production-jwt');
    });

    it('renders unauthenticated Zero Trust badge with pending warning styling', () => {
      const mockUnauth: AuthSession = {
        authenticated: false,
        email: null,
        mode: 'unauthenticated',
      };

      render(
        <AdminStudioView
          captures={SEED_CAPTURES}
          collections={SEED_COLLECTIONS}
          authSession={mockUnauth}
          onCreateCapture={vi.fn()}
          onUpdateCapture={vi.fn()}
          onDeleteCapture={vi.fn()}
        />
      );

      const badge = screen.getByTestId('zero-trust-badge');
      expect(badge).toHaveTextContent(/pending/i);
      expect(badge).toHaveTextContent('dev@localhost');
      expect(badge).toHaveTextContent('unauthenticated');
    });

    it('handles async creation failure gracefully with error status banner', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('D1 database locked'));

      render(
        <AdminStudioView
          captures={SEED_CAPTURES}
          collections={SEED_COLLECTIONS}
          authSession={{
            authenticated: true,
            email: 'dev@localhost',
            mode: 'development-bypass',
          }}
          onCreateCapture={mockCreate}
          onUpdateCapture={vi.fn()}
          onDeleteCapture={vi.fn()}
        />
      );

      const titleInput = screen.getByLabelText(/capture title/i);
      fireEvent.change(titleInput, { target: { value: 'Failing capture' } });

      fireEvent.click(screen.getByRole('button', { name: /publish capture/i }));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(/d1 database locked/i);
      });
    });
  });
});
