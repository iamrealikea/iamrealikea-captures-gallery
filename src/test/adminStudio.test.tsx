/**
 * proposed_adminStudio.test.tsx
 *
 * Comprehensive Test Suite for Browser-based Admin Curation Studio (/admin).
 *
 * Covers:
 * 1. Cloudflare Access Zero Trust badge rendering (status, user email, development-bypass mode)
 * 2. Drag-and-drop file upload dropzone with 25MB validation and drag-state styling
 * 3. Client-side EXIF auto-extraction via exifr from authentic JPEG buffer fixtures
 * 4. Automatic form population (inferred title, camera body, lens, exposure, ISO, dimensions)
 * 5. Validation error alerting on empty capture title submission
 * 6. Capture creation lifecycle and management table row rendering
 * 7. Capture editing with pre-filled inputs, title modifications, and edit cancellation
 * 8. Featured toggle inline action with Sparkles badge and accessible label updates
 * 9. Confirmation-backed capture deletion dialog preventing accidental data loss
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import App from '../../src/App';
import { defaultMockStore } from '../../src/data/mockStore';
import { buildExifJpeg } from '../../scripts/generate-sample-captures';

describe('Admin Curation Studio Test Suite', () => {
  beforeEach(() => {
    defaultMockStore.reset();
    window.history.replaceState({}, '', '/admin');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Cloudflare Access Zero Trust Security Perimeter', () => {
    it('renders the Zero Trust status badge with authenticated email and mode', () => {
      render(<App />);

      const badge = screen.getByTestId('zero-trust-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/cloudflare access zero trust/i);
      expect(badge).toHaveTextContent(/dev@localhost/i);
      expect(badge).toHaveTextContent(/development-bypass/i);
    });
  });

  describe('2. Drag-and-Drop Image Dropzone', () => {
    it('displays the upload dropzone with file constraints and handles drag states', () => {
      render(<App />);

      const fileInput = screen.getByLabelText(/drop photograph or select image file/i);
      expect(fileInput).toHaveAttribute(
        'accept',
        'image/jpeg,image/png,image/webp,image/avif'
      );

      // Verify instruction copy
      expect(
        screen.getByText(/jpeg, png, webp, or avif up to 25mb/i)
      ).toBeInTheDocument();

      // Test drag-over styling
      const dropzone = fileInput.closest('div');
      expect(dropzone).not.toBeNull();
      if (dropzone) {
        fireEvent.dragOver(dropzone);
        expect(dropzone).toHaveClass('border-blue-600', 'bg-blue-50/50');

        fireEvent.dragLeave(dropzone);
        expect(dropzone).toHaveClass('border-slate-300');
      }
    });
  });

  describe('3. Client-Side EXIF Extraction via exifr', () => {
    it('extracts technical telemetry from an authentic JPEG file and populates form fields', async () => {
      render(<App />);

      // Generate authentic EXIF JPEG buffer
      const jpegBytes = buildExifJpeg({
        filePath: 'captures/architecture/osaka-tower-geometry.jpg',
        width: 4800,
        height: 3200,
        make: 'Sony',
        model: 'Sony A7R V',
        lensModel: 'FE 16-35mm f/2.8 GM II',
        focalLength: 24,
        fNumber: 5.6,
        exposureTime: 0.004, // 1/250s
        iso: 100,
        dateTimeOriginal: '2026:04:10 09:20:00',
      });

      const file = new File([new Uint8Array(jpegBytes)], 'osaka-tower-geometry.jpg', {
        type: 'image/jpeg',
      });

      const fileInput = screen.getByLabelText(/drop photograph or select image file/i);
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Wait for client-side extraction banner
      await waitFor(() => {
        expect(screen.getByTestId('exif-extracted-banner')).toBeInTheDocument();
      });

      const banner = screen.getByTestId('exif-extracted-banner');
      expect(banner).toHaveTextContent(/Sony A7R V/i);
      expect(banner).toHaveTextContent(/FE 16-35mm f\/2\.8 GM II/i);
      expect(banner).toHaveTextContent(/24mm/i);
      expect(banner).toHaveTextContent(/f\/5\.6/i);
      expect(banner).toHaveTextContent(/1\/250s/i);
      expect(banner).toHaveTextContent(/ISO 100/i);

      // Verify populated form fields
      expect(screen.getByLabelText(/capture title/i)).toHaveValue('Osaka tower geometry');
      expect(screen.getByLabelText(/camera body/i)).toHaveValue('Sony A7R V');
      expect(screen.getByLabelText(/lens model/i)).toHaveValue('FE 16-35mm f/2.8 GM II');
      expect(screen.getByLabelText(/focal length/i)).toHaveValue('24mm');
      expect(screen.getByLabelText(/aperture/i)).toHaveValue('f/5.6');
      expect(screen.getByLabelText(/shutter speed/i)).toHaveValue('1/250s');
      expect(screen.getByLabelText(/iso sensitivity/i)).toHaveValue(100);
    });
  });

  describe('4. Capture Creation & Validation', () => {
    it('displays validation alert when title is blank and creates capture upon valid submission', async () => {
      render(<App />);

      const publishBtn = screen.getByRole('button', { name: /publish capture/i });

      // 1. Submit empty title -> error alert
      fireEvent.click(publishBtn);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/please enter a capture title before saving/i);

      // 2. Enter valid title and metadata
      const titleInput = screen.getByLabelText(/capture title/i);
      fireEvent.change(titleInput, { target: { value: 'Gothenburg harbor crane' } });

      const locationInput = screen.getByLabelText(/location/i);
      fireEvent.change(locationInput, { target: { value: 'Gothenburg, Sweden' } });

      fireEvent.click(publishBtn);

      // Verify success status
      await waitFor(() => {
        const status = screen.getByRole('status');
        expect(status).toHaveTextContent(
          /published capture "gothenburg harbor crane" to r2 and d1/i
        );
      });

      // Verify new capture row in table
      expect(
        screen.getByTestId('admin-capture-row-gothenburg-harbor-crane')
      ).toBeInTheDocument();

      // Verify form reset
      expect(titleInput).toHaveValue('');
    });
  });

  describe('5. Capture Editing Lifecycle', () => {
    it('populates form for editing, cancels without saving, and applies edits', async () => {
      render(<App />);

      // Find existing capture row
      const targetRow = screen.getByTestId('admin-capture-row-brutalist-atrium-01');
      const editBtn = within(targetRow).getByRole('button', {
        name: /edit brutalist concrete atrium/i,
      });

      // 1. Enter edit mode
      fireEvent.click(editBtn);
      expect(
        screen.getByRole('heading', { name: /edit capture metadata/i })
      ).toBeInTheDocument();

      const titleInput = screen.getByLabelText(/capture title/i);
      expect(titleInput).toHaveValue('Brutalist concrete atrium');

      // 2. Test "Cancel edit" button
      const cancelBtn = screen.getByRole('button', { name: /cancel edit/i });
      fireEvent.click(cancelBtn);
      expect(
        screen.getByRole('heading', { name: /ingest new capture/i })
      ).toBeInTheDocument();
      expect(titleInput).toHaveValue('');

      // 3. Re-enter edit mode and update title & location
      fireEvent.click(editBtn);
      fireEvent.change(titleInput, { target: { value: 'Barbican highwalk perspective' } });

      const saveBtn = screen.getByRole('button', { name: /save capture changes/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent(
          /updated capture "barbican highwalk perspective"/i
        );
      });

      expect(
        screen.getByText('Barbican highwalk perspective')
      ).toBeInTheDocument();
    });
  });

  describe('6. Featured Status Inline Toggle', () => {
    it('toggles featured state inline and updates button attributes and badge', async () => {
      render(<App />);

      // Use a known unfeatured capture row
      const row = screen.getByTestId('admin-capture-row-spiral-concrete-stairs');
      const toggleBtn = within(row).getByRole('button', {
        name: /feature spiral concrete stairwell/i,
      });

      // 1. Click to Feature
      fireEvent.click(toggleBtn);
      await waitFor(() => {
        expect(within(row).getAllByText('Featured').length).toBeGreaterThanOrEqual(1);
        expect(
          within(row).getByRole('button', {
            name: /unfeature spiral concrete stairwell/i,
          })
        ).toBeInTheDocument();
      });

      // 2. Click to Unfeature
      const unfeatureBtn = within(row).getByRole('button', {
        name: /unfeature spiral concrete stairwell/i,
      });
      fireEvent.click(unfeatureBtn);
      await waitFor(() => {
        expect(within(row).queryByText('Featured')).not.toBeInTheDocument();
        expect(
          within(row).getByRole('button', {
            name: /feature spiral concrete stairwell/i,
          })
        ).toBeInTheDocument();
      });
    });
  });

  describe('7. Confirmation-Backed Deletion', () => {
    it('requires explicit confirmation before deleting capture and cancels gracefully', async () => {
      render(<App />);

      // Ingest a temporary capture to test deletion safely
      const titleInput = screen.getByLabelText(/capture title/i);
      fireEvent.change(titleInput, { target: { value: 'Temporary test frame' } });
      fireEvent.click(screen.getByRole('button', { name: /publish capture/i }));

      await waitFor(() => {
        expect(
          screen.getByTestId('admin-capture-row-temporary-test-frame')
        ).toBeInTheDocument();
      });

      const tempRow = screen.getByTestId('admin-capture-row-temporary-test-frame');

      // 1. Click Delete -> prompts for confirmation
      const deleteBtn = within(tempRow).getByRole('button', {
        name: /delete temporary test frame/i,
      });
      fireEvent.click(deleteBtn);

      const confirmBtn = within(tempRow).getByRole('button', {
        name: /confirm delete temporary test frame/i,
      });
      const cancelDeleteBtn = within(tempRow).getByRole('button', {
        name: /cancel/i,
      });
      expect(confirmBtn).toBeInTheDocument();
      expect(cancelDeleteBtn).toBeInTheDocument();

      // 2. Click Cancel -> aborts deletion
      fireEvent.click(cancelDeleteBtn);
      expect(
        screen.getByTestId('admin-capture-row-temporary-test-frame')
      ).toBeInTheDocument();

      // 3. Click Delete and Confirm delete -> deletes record
      const reDeleteBtn = within(tempRow).getByRole('button', {
        name: /delete temporary test frame/i,
      });
      fireEvent.click(reDeleteBtn);

      const reConfirmBtn = within(tempRow).getByRole('button', {
        name: /confirm delete temporary test frame/i,
      });
      fireEvent.click(reConfirmBtn);

      await waitFor(() => {
        expect(
          screen.queryByTestId('admin-capture-row-temporary-test-frame')
        ).not.toBeInTheDocument();
      });

      expect(screen.getByRole('status')).toHaveTextContent(
        /deleted capture "temporary test frame"/i
      );
    });
  });
});
