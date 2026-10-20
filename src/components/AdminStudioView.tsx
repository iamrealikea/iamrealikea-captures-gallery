/**
 * src/components/AdminStudioView.tsx (Proposed Implementation)
 *
 * Pipeline B: Browser-based Admin Curation Studio (/admin).
 * Features:
 * 1. Cloudflare Access Zero Trust status badge (authenticated status, email, mode)
 * 2. Drag-and-drop image dropzone with 25MB & MIME validation, and exifr client-side EXIF auto-extraction
 * 3. Metadata curation form with pre-populated EXIF, story textarea with text-wrap: pretty, tag chips
 * 4. Indexed capture catalog table with photo thumbnails, metadata, date, featured toggle, edit, and delete
 * 5. Native accessible <dialog closedby="any"> confirmation-backed deletion modal with coordinate-boundary backdrop click fallback
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Edit3,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  AuthSession,
  Capture,
  Collection,
  CreateCaptureInput,
  UpdateCaptureInput,
} from '../types/gallery';
import {
  extractExifMetadata,
  slugify,
  titleFromFilename,
} from '../utils/exifExtractor';
import { createSvgPlaceholder } from '../utils/imagePlaceholder';

export interface AdminStudioViewProps {
  captures: Capture[];
  collections: Collection[];
  authSession: AuthSession;
  onCreateCapture: (input: CreateCaptureInput) => Promise<Capture> | Capture;
  onUpdateCapture: (
    id: string,
    updates: UpdateCaptureInput
  ) => Promise<Capture> | Capture;
  onDeleteCapture: (id: string) => Promise<void> | void;
}

interface FormState {
  title: string;
  collection_slug: string;
  location: string;
  story: string;
  tagsInput: string;
  camera_model: string;
  lens_model: string;
  focal_length: string;
  aperture: string;
  shutter_speed: string;
  iso: string;
  captured_at: string;
  width: string;
  height: string;
  image_url: string;
  featured: boolean;
}

const INITIAL_FORM_STATE: FormState = {
  title: '',
  collection_slug: 'architecture',
  location: '',
  story: '',
  tagsInput: '',
  camera_model: '',
  lens_model: '',
  focal_length: '',
  aperture: '',
  shutter_speed: '',
  iso: '',
  captured_at: '',
  width: '3840',
  height: '2560',
  image_url: '',
  featured: false,
};

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);
const ALLOWED_EXTENSIONS = /\.(jpe?g|png|webp|avif)$/i;

/**
 * Accessible confirmation-backed deletion modal utilizing native <dialog closedby="any">
 * with coordinate-boundary backdrop click fallback.
 */
interface DeleteConfirmModalProps {
  capture: Capture;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  capture,
  isOpen,
  onClose,
  onConfirm,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    dialog.setAttribute('closedby', 'any');

    if (isOpen) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          try {
            dialog.showModal();
          } catch {
            dialog.setAttribute('open', '');
          }
        } else {
          dialog.setAttribute('open', '');
        }
      }
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') {
        try {
          dialog.close();
        } catch {
          dialog.removeAttribute('open');
        }
      } else {
        dialog.removeAttribute('open');
      }
    }
  }, [isOpen]);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || event.target !== dialog) return;

    const rect = dialog.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const right = rect.right ?? rect.left + rect.width;
      const bottom = rect.bottom ?? rect.top + rect.height;
      const isOutside =
        event.clientX < rect.left ||
        event.clientX > right ||
        event.clientY < rect.top ||
        event.clientY > bottom;

      if (!isOutside) return;
    }

    if (typeof dialog.close === 'function') {
      try {
        dialog.close();
      } catch {
        // ignore
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      closedby="any"
      aria-labelledby={`delete-title-${capture.id}`}
      aria-describedby={`delete-desc-${capture.id}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={handleBackdropClick}
      className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl backdrop:bg-slate-900/60"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            id={`delete-title-${capture.id}`}
            className="text-base font-semibold text-slate-900"
          >
            Delete photograph?
          </h3>
          <p
            id={`delete-desc-${capture.id}`}
            className="mt-1 text-sm leading-5 text-slate-600"
            style={{ textWrap: 'pretty' }}
          >
            Are you sure you want to permanently delete{' '}
            <strong className="text-slate-900 font-semibold">
              &ldquo;{capture.title}&rdquo;
            </strong>
            ? This action removes the database record from Cloudflare D1 and
            deletes the asset from Cloudflare R2 object storage. This cannot be
            undone.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isDeleting}
          onClick={async () => {
            setIsDeleting(true);
            try {
              await onConfirm();
            } finally {
              setIsDeleting(false);
            }
          }}
          aria-label={`Confirm delete ${capture.title}`}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          <span>{isDeleting ? 'Deleting...' : 'Confirm delete'}</span>
        </button>
      </div>
    </dialog>
  );
};

export const AdminStudioView: React.FC<AdminStudioViewProps> = ({
  captures,
  collections,
  authSession,
  onCreateCapture,
  onUpdateCapture,
  onDeleteCapture,
}) => {
  const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [exifBanner, setExifBanner] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // File validation & extraction handler
  const handleFileProcess = async (file: File) => {
    setStatusMessage(null);

    // 1. Validate file size (up to 25MB)
    if (file.size > MAX_UPLOAD_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setStatusMessage({
        type: 'error',
        text: `File "${file.name}" exceeds maximum upload limit of 25MB (${sizeMb}MB).`,
      });
      return;
    }

    // 2. Validate MIME type & file extension
    const isValidMime = file.type ? ALLOWED_MIME_TYPES.has(file.type) : false;
    const isValidExt = ALLOWED_EXTENSIONS.test(file.name);
    if (!isValidMime && !isValidExt) {
      setStatusMessage({
        type: 'error',
        text: `Unsupported image format "${file.name}". Please upload JPEG, PNG, WebP, or AVIF files.`,
      });
      return;
    }

    try {
      // 3. Client-side EXIF auto-extraction via exifr
      const exif = await extractExifMetadata(file);
      const inferredTitle = titleFromFilename(file.name);

      // Create browser blob object URL for immediate local preview
      let previewUrl = '';
      try {
        previewUrl = URL.createObjectURL(file);
      } catch {
        previewUrl = '';
      }

      setForm((prev) => ({
        ...prev,
        title: prev.title.trim() ? prev.title : inferredTitle,
        camera_model: exif.camera_model || prev.camera_model,
        lens_model: exif.lens_model || prev.lens_model,
        focal_length: exif.focal_length || prev.focal_length,
        aperture: exif.aperture || prev.aperture,
        shutter_speed: exif.shutter_speed || prev.shutter_speed,
        iso: exif.iso ? String(exif.iso) : prev.iso,
        captured_at: exif.captured_at
          ? exif.captured_at.slice(0, 16)
          : prev.captured_at,
        width: exif.width ? String(exif.width) : prev.width,
        height: exif.height ? String(exif.height) : prev.height,
        image_url:
          previewUrl ||
          prev.image_url ||
          createSvgPlaceholder(
            inferredTitle,
            prev.collection_slug,
            exif.width || 1600,
            exif.height || 1067
          ),
      }));

      const detectedParts = [
        exif.camera_model,
        exif.lens_model,
        exif.focal_length,
        exif.aperture,
        exif.shutter_speed,
        exif.iso ? `ISO ${exif.iso}` : null,
      ].filter(Boolean);

      setExifBanner(
        detectedParts.length > 0
          ? `EXIF telemetry extracted from ${file.name}: ${detectedParts.join(' • ')}`
          : `Processed ${file.name} (${exif.width || 3840}×${exif.height || 2560} px)`
      );
      setTitleError(null);
    } catch {
      setStatusMessage({
        type: 'error',
        text: `Could not read EXIF metadata from ${file.name}. You can still enter fields manually.`,
      });
    }
  };

  const handleFileInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      await handleFileProcess(file);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      await handleFileProcess(file);
    }
  };

  const startEditing = (capture: Capture) => {
    setEditingId(capture.id);
    setTitleError(null);
    setExifBanner(null);
    setStatusMessage(null);
    setForm({
      title: capture.title,
      collection_slug: capture.collection_slug,
      location: capture.location || '',
      story: capture.story || '',
      tagsInput: (capture.tags || []).join(', '),
      camera_model: capture.camera_model || '',
      lens_model: capture.lens_model || '',
      focal_length: capture.focal_length || '',
      aperture: capture.aperture || '',
      shutter_speed: capture.shutter_speed || '',
      iso: capture.iso ? String(capture.iso) : '',
      captured_at: capture.captured_at ? capture.captured_at.slice(0, 16) : '',
      width: String(capture.width),
      height: String(capture.height),
      image_url: capture.image_url,
      featured: capture.featured,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setForm(INITIAL_FORM_STATE);
    setExifBanner(null);
    setTitleError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setTitleError('Please enter a capture title before saving.');
      return;
    }
    setTitleError(null);

    const width = Number(form.width) > 0 ? Number(form.width) : 3840;
    const height = Number(form.height) > 0 ? Number(form.height) : 2560;
    const aspectRatio = Number((width / height).toFixed(2));
    const tags = form.tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const slug = slugify(form.title);

    const payload: CreateCaptureInput = {
      title: form.title.trim(),
      slug,
      collection_slug: form.collection_slug,
      location: form.location.trim() || null,
      story: form.story.trim() || null,
      camera_model: form.camera_model.trim() || null,
      lens_model: form.lens_model.trim() || null,
      focal_length: form.focal_length.trim() || null,
      aperture: form.aperture.trim() || null,
      shutter_speed: form.shutter_speed.trim() || null,
      iso: form.iso ? Number(form.iso) : null,
      captured_at: form.captured_at
        ? new Date(form.captured_at).toISOString()
        : new Date().toISOString(),
      width,
      height,
      aspect_ratio: aspectRatio,
      tags,
      featured: form.featured,
      r2_key: `captures/${form.collection_slug}/${slug}.jpg`,
      image_url:
        form.image_url.trim() ||
        createSvgPlaceholder(
          form.title.trim(),
          form.collection_slug,
          width,
          height
        ),
    };

    try {
      if (editingId) {
        await onUpdateCapture(editingId, payload);
        setStatusMessage({
          type: 'success',
          text: `Updated capture "${payload.title}".`,
        });
        setEditingId(null);
      } else {
        await onCreateCapture(payload);
        setStatusMessage({
          type: 'success',
          text: `Published capture "${payload.title}" to R2 and D1.`,
        });
      }
      setForm(INITIAL_FORM_STATE);
      setExifBanner(null);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Failed to save capture metadata.',
      });
    }
  };

  const parsedTagChips = form.tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div className="space-y-10">
      {/* Studio Header & Cloudflare Access Zero Trust Status Badge */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1
            id="admin-view-heading"
            tabIndex={-1}
            className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl focus:outline-none"
            style={{ textWrap: 'balance' }}
          >
            Admin curation studio
          </h1>
          <p
            className="mt-1 max-w-[65ch] text-sm leading-6 text-slate-600"
            style={{ textWrap: 'pretty' }}
          >
            Ingest new photographs with client-side EXIF extraction, curate
            stories, and manage Cloudflare D1 &amp; R2 records.
          </p>
        </div>

        {/* Zero Trust Status Badge */}
        <div
          data-testid="zero-trust-badge"
          className="inline-flex items-center gap-3 self-start rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs sm:self-auto"
        >
          {authSession.authenticated ? (
            <ShieldCheck
              className="h-5 w-5 shrink-0 text-green-600"
              aria-hidden="true"
            />
          ) : (
            <ShieldAlert
              className="h-5 w-5 shrink-0 text-amber-600"
              aria-hidden="true"
            />
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-900">
                Cloudflare Access Zero Trust
              </span>
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                  authSession.authenticated
                    ? 'bg-green-100 text-green-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {authSession.authenticated ? 'Authenticated' : 'Pending'}
              </span>
            </div>
            <span className="block text-slate-500">
              {authSession.email || 'dev@localhost'} ({authSession.mode})
            </span>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {statusMessage && (
        <div
          role="status"
          className={`flex items-center gap-2.5 rounded-xl border p-4 text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2
              className="h-5 w-5 shrink-0 text-green-600"
              aria-hidden="true"
            />
          ) : (
            <AlertCircle
              className="h-5 w-5 shrink-0 text-red-600"
              aria-hidden="true"
            />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Main Studio Grid: Ingestion Form + Management Table */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Drag-and-Drop EXIF Extractor & Metadata Form */}
        <section
          aria-labelledby="curation-form-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-5"
        >
          <div className="flex items-center justify-between gap-2">
            <h2
              id="curation-form-heading"
              className="text-lg font-semibold text-slate-900"
            >
              {editingId ? 'Edit capture metadata' : 'Ingest new capture'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={cancelEditing}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancel edit
              </button>
            )}
          </div>

          {/* Drag-and-Drop File Upload Zone */}
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
            }}
            onDrop={handleDrop}
            className={`mt-4 rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
              isDragging
                ? 'border-blue-600 bg-blue-50/50'
                : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
            }`}
          >
            <Upload
              className="mx-auto h-6 w-6 text-blue-600"
              aria-hidden="true"
            />
            <label
              htmlFor="admin-file-upload"
              className="mt-2 block cursor-pointer text-sm font-semibold text-slate-900 hover:text-blue-600"
            >
              Drop photograph or select image file
            </label>
            <p className="mt-1 text-xs text-slate-500">
              JPEG, PNG, WebP, or AVIF up to 25MB. Automatically extracts camera
              EXIF &amp; dimensions.
            </p>
            <input
              id="admin-file-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleFileInputChange}
              className="mt-3 block w-full text-xs text-slate-600 file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-50"
            />
          </div>

          {/* EXIF Auto-Extraction Confirmation Banner */}
          {exifBanner && (
            <div
              data-testid="exif-extracted-banner"
              className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs font-medium text-blue-900"
            >
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
                aria-hidden="true"
              />
              <span>{exifBanner}</span>
            </div>
          )}

          {/* Metadata Curation Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
            {/* Title */}
            <div>
              <label
                htmlFor="capture-title-input"
                className="block text-sm font-medium text-slate-700"
              >
                Capture title
              </label>
              <input
                id="capture-title-input"
                type="text"
                value={form.title}
                onChange={(e) => {
                  setForm({ ...form, title: e.target.value });
                  if (titleError) setTitleError(null);
                }}
                placeholder="e.g. Brutalist concrete atrium"
                className="mt-1.5 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              {titleError && (
                <p
                  role="alert"
                  className="mt-1.5 flex items-center gap-1.5 text-sm text-red-600"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{titleError}</span>
                </p>
              )}
            </div>

            {/* Collection & Location */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="capture-collection-select"
                  className="block text-sm font-medium text-slate-700"
                >
                  Collection
                </label>
                <select
                  id="capture-collection-select"
                  value={form.collection_slug}
                  onChange={(e) =>
                    setForm({ ...form, collection_slug: e.target.value })
                  }
                  className="mt-1.5 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {collections.map((col) => (
                    <option key={col.id} value={col.slug}>
                      {col.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="capture-location-input"
                  className="block text-sm font-medium text-slate-700"
                >
                  Location
                </label>
                <input
                  id="capture-location-input"
                  type="text"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  placeholder="e.g. Shibuya, Tokyo"
                  className="mt-1.5 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Story Narrative (text-wrap: pretty) */}
            <div>
              <label
                htmlFor="capture-story-input"
                className="block text-sm font-medium text-slate-700"
              >
                Editorial story
              </label>
              <textarea
                id="capture-story-input"
                rows={3}
                value={form.story}
                onChange={(e) => setForm({ ...form, story: e.target.value })}
                placeholder="Describe lighting, architectural geometry, or field conditions..."
                style={{ textWrap: 'pretty' }}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* EXIF Telemetry Fields (Auto-filled from exifr) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Camera &amp; optical EXIF fields
              </span>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="capture-camera-input"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Camera body
                  </label>
                  <input
                    id="capture-camera-input"
                    type="text"
                    value={form.camera_model}
                    onChange={(e) =>
                      setForm({ ...form, camera_model: e.target.value })
                    }
                    placeholder="e.g. Leica Q2"
                    className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="capture-lens-input"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Lens model
                  </label>
                  <input
                    id="capture-lens-input"
                    type="text"
                    value={form.lens_model}
                    onChange={(e) =>
                      setForm({ ...form, lens_model: e.target.value })
                    }
                    placeholder="e.g. Summilux 28mm f/1.7 ASPH"
                    className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="capture-focal-input"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Focal length
                  </label>
                  <input
                    id="capture-focal-input"
                    type="text"
                    value={form.focal_length}
                    onChange={(e) =>
                      setForm({ ...form, focal_length: e.target.value })
                    }
                    placeholder="e.g. 28mm"
                    className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="capture-aperture-input"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Aperture
                  </label>
                  <input
                    id="capture-aperture-input"
                    type="text"
                    value={form.aperture}
                    onChange={(e) =>
                      setForm({ ...form, aperture: e.target.value })
                    }
                    placeholder="e.g. f/2.8"
                    className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="capture-shutter-input"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Shutter speed
                  </label>
                  <input
                    id="capture-shutter-input"
                    type="text"
                    value={form.shutter_speed}
                    onChange={(e) =>
                      setForm({ ...form, shutter_speed: e.target.value })
                    }
                    placeholder="e.g. 1/250s"
                    className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="capture-iso-input"
                    className="block text-xs font-medium text-slate-700"
                  >
                    ISO sensitivity
                  </label>
                  <input
                    id="capture-iso-input"
                    type="number"
                    value={form.iso}
                    onChange={(e) => setForm({ ...form, iso: e.target.value })}
                    placeholder="e.g. 100"
                    className="mt-1 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            {/* Tags Input & Chips Preview */}
            <div>
              <label
                htmlFor="capture-tags-input"
                className="block text-sm font-medium text-slate-700"
              >
                Tags (comma-separated)
              </label>
              <input
                id="capture-tags-input"
                type="text"
                value={form.tagsInput}
                onChange={(e) =>
                  setForm({ ...form, tagsInput: e.target.value })
                }
                placeholder="brutalism, concrete, monochrome"
                className="mt-1.5 w-full min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              {parsedTagChips.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {parsedTagChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600"
                    >
                      #{chip}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Featured Checkbox */}
            <div className="flex items-center gap-2.5">
              <input
                id="capture-featured-checkbox"
                type="checkbox"
                checked={form.featured}
                onChange={(e) =>
                  setForm({ ...form, featured: e.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <label
                htmlFor="capture-featured-checkbox"
                className="text-sm font-medium text-slate-700"
              >
                Feature this capture in primary gallery sorting
              </label>
            </div>

            {/* Form Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>
                  {editingId ? 'Save capture changes' : 'Publish capture'}
                </span>
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Right Column: Capture Management Table */}
        <section
          aria-labelledby="capture-table-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-7"
        >
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2
                id="capture-table-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Indexed D1 capture catalog ({captures.length})
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Manage featured status, edit metadata, or remove records from D1
                and R2.
              </p>
            </div>
          </div>

          <div className="mt-4 divide-y divide-slate-200">
            {captures.map((cap) => {
              const isConfirmingDelete = confirmDeleteId === cap.id;
              const formattedDate = cap.captured_at
                ? new Date(cap.captured_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Date unrecorded';

              return (
                <div
                  key={cap.id}
                  data-testid={`admin-capture-row-${cap.slug}`}
                  className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center"
                >
                  {/* Thumbnail & Title/EXIF Info */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <img
                      src={cap.image_url}
                      alt={cap.title}
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget;
                        const fallback = createSvgPlaceholder(
                          cap.title,
                          cap.collection_slug,
                          cap.width || 400,
                          cap.height || 300
                        );
                        if (target.src !== fallback) {
                          target.src = fallback;
                        }
                      }}
                      className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover bg-slate-100"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">
                          {cap.title}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {cap.collection_slug}
                        </span>
                        {cap.featured && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            <Sparkles className="h-3 w-3" aria-hidden="true" />
                            <span>Featured</span>
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs text-slate-500">
                        <span>{cap.camera_model || 'Unknown camera'}</span>
                        {cap.focal_length && <span>• {cap.focal_length}</span>}
                        {cap.aperture && <span>• {cap.aperture}</span>}
                        {cap.shutter_speed && <span>• {cap.shutter_speed}</span>}
                        {cap.iso && <span>• ISO {cap.iso}</span>}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Row Actions */}
                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateCapture(cap.id, { featured: !cap.featured })
                      }
                      aria-label={
                        cap.featured
                          ? `Unfeature ${cap.title}`
                          : `Feature ${cap.title}`
                      }
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                        cap.featured
                          ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{cap.featured ? 'Featured' : 'Feature'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => startEditing(cap)}
                      aria-label={`Edit ${cap.title}`}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(cap.id)}
                      aria-label={`Delete ${cap.title}`}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Delete</span>
                    </button>

                    {/* Accessible Confirmation Deletion Native Modal Dialog */}
                    <DeleteConfirmModal
                      capture={cap}
                      isOpen={isConfirmingDelete}
                      onClose={() => setConfirmDeleteId(null)}
                      onConfirm={async () => {
                        await onDeleteCapture(cap.id);
                        setConfirmDeleteId(null);
                        setStatusMessage({
                          type: 'success',
                          text: `Deleted capture "${cap.title}".`,
                        });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminStudioView;
