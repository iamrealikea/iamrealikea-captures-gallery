/**
 * src/utils/exifExtractor.ts
 *
 * Universal EXIF telemetry and binary dimension extractor supporting both
 * browser File/Blob uploads in Admin Curation Studio and Node Buffers in CLI sync.
 */

import exifr from 'exifr';
import {
  formatAperture,
  formatFocalLength,
  formatShutterSpeed,
  type ExifMetadata,
} from '../types/gallery';

/**
 * Parses pixel width and height directly from JPEG (SOF0/SOF2) or PNG (IHDR) binary headers.
 * Acts as a reliable fallback when stripped or minimal EXIF IFDs omit ExifImageWidth/Height.
 */
export function parseBinaryDimensions(
  bytes: Uint8Array
): { width: number; height: number } | null {
  if (!bytes || bytes.length < 24) return null;

  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    if (width > 0 && height > 0) {
      return { width, height };
    }
  }

  // JPEG signature: FF D8
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 2;
    while (offset < bytes.length - 8) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      // Skip padding 0xFF bytes
      if (marker === 0xff) {
        offset++;
        continue;
      }
      // Standalone markers without length
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      // SOF0 (Baseline DCT) = 0xC0, SOF1 = 0xC1, SOF2 (Progressive DCT) = 0xC2
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        if (offset + 8 < bytes.length) {
          const height = view.getUint16(offset + 5, false);
          const width = view.getUint16(offset + 7, false);
          if (width > 0 && height > 0) {
            return { width, height };
          }
        }
        break;
      }
      if (offset + 3 >= bytes.length) break;
      const segmentLength = view.getUint16(offset + 2, false);
      if (segmentLength < 2) break;
      offset += 2 + segmentLength;
    }
  }

  return null;
}

/**
 * Normalizes EXIF DateTimeOriginal (Date instance or "YYYY:MM:DD HH:MM:SS" string)
 * into an ISO 8601 timestamp string.
 */
export function normalizeExifDate(raw: unknown): string | null {
  if (!raw) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString();
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    // Match EXIF format "YYYY:MM:DD HH:MM:SS"
    const exifMatch = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(trimmed);
    if (exifMatch) {
      const [, y, m, d, hh, mm, ss] = exifMatch;
      return `${y}-${m}-${d}T${hh}:${mm}:${ss}Z`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return null;
}

/**
 * Converts a File, Blob, ArrayBuffer, or Uint8Array into a Uint8Array for binary inspection.
 */
async function toUint8Array(
  input: File | Blob | ArrayBuffer | Uint8Array
): Promise<Uint8Array> {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  if (typeof (input as Blob).arrayBuffer === 'function') {
    const ab = await (input as Blob).arrayBuffer();
    return new Uint8Array(ab);
  }
  // Fallback for environments where File.arrayBuffer is not defined
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsArrayBuffer(input as Blob);
  });
}

/**
 * Extracts EXIF telemetry and dimensions from an image binary or File.
 */
export async function extractExifMetadata(
  input: File | Blob | ArrayBuffer | Uint8Array
): Promise<ExifMetadata> {
  let bytes: Uint8Array | null = null;
  try {
    bytes = await toUint8Array(input);
  } catch {
    bytes = null;
  }

  let parsed: Record<string, any> | null = null;
  try {
    parsed = await exifr.parse(bytes ?? input, {
      tiff: true,
      exif: true,
      gps: true,
    });
  } catch {
    parsed = null;
  }

  const binaryDims = bytes ? parseBinaryDimensions(bytes) : null;

  const rawWidth =
    parsed?.ExifImageWidth ??
    parsed?.ImageWidth ??
    parsed?.PixelXDimension ??
    binaryDims?.width ??
    null;

  const rawHeight =
    parsed?.ExifImageHeight ??
    parsed?.ImageHeight ??
    parsed?.PixelYDimension ??
    binaryDims?.height ??
    null;

  const rawFocal = parsed?.FocalLength;
  const rawFNumber = parsed?.FNumber ?? parsed?.ApertureValue;
  const rawExposure = parsed?.ExposureTime ?? parsed?.ShutterSpeedValue;
  const rawIso = parsed?.ISO ?? parsed?.ISOSpeedRatings;
  const rawDate =
    parsed?.DateTimeOriginal ?? parsed?.CreateDate ?? parsed?.ModifyDate;

  return {
    camera_make: parsed?.Make ? String(parsed.Make).trim() : null,
    camera_model: parsed?.Model ? String(parsed.Model).trim() : null,
    lens_model: parsed?.LensModel ? String(parsed.LensModel).trim() : null,
    focal_length:
      rawFocal !== undefined && rawFocal !== null
        ? formatFocalLength(rawFocal)
        : null,
    aperture:
      rawFNumber !== undefined && rawFNumber !== null
        ? formatAperture(rawFNumber)
        : null,
    shutter_speed:
      rawExposure !== undefined && rawExposure !== null
        ? formatShutterSpeed(rawExposure)
        : null,
    iso:
      typeof rawIso === 'number' && !Number.isNaN(rawIso)
        ? Math.round(rawIso)
        : null,
    captured_at: normalizeExifDate(rawDate),
    width: typeof rawWidth === 'number' && rawWidth > 0 ? rawWidth : null,
    height: typeof rawHeight === 'number' && rawHeight > 0 ? rawHeight : null,
    latitude: typeof parsed?.latitude === 'number' ? parsed.latitude : null,
    longitude: typeof parsed?.longitude === 'number' ? parsed.longitude : null,
  };
}

/**
 * Generates a human-friendly title from an image filename or slug.
 * e.g. "brutalist-atrium-01.jpg" -> "Brutalist atrium 01"
 */
export function titleFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (!base) return 'Untitled capture';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Generates a URL-safe slug from a title or filename.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
