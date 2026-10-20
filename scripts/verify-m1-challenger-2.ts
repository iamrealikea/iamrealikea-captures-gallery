/**
 * scripts/verify-m1-challenger-2.ts
 *
 * Empirical verification and stress harness for Milestone 1:
 * 1. exifr extraction on all 6 sample captures vs expected configuration.
 * 2. Dimension parsing analysis (exifr vs JPEG SOF0 marker).
 * 3. rowToCapture & captureToRow serialization and robustness (valid, empty, corrupted, edge cases).
 * 4. Telemetry formatters robustness (formatAperture, formatShutterSpeed, formatFocalLength, formatIso).
 */

import fs from 'node:fs';
import path from 'node:path';
import exifr from 'exifr';
import {
  rowToCapture,
  captureToRow,
  formatAperture,
  formatShutterSpeed,
  formatFocalLength,
  formatIso,
  type CaptureRow,
  type Capture
} from '../src/types/gallery';
import { SAMPLE_CAPTURES } from './generate-sample-captures';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    results.push({ name, passed: true, details });
  } else {
    results.push({ name, passed: false, details: details || 'Assertion failed', error: 'FAILED' });
  }
}

function getJpegSof0Dimensions(buffer: Buffer): { width: number; height: number } | null {
  for (let i = 0; i < buffer.length - 8; i++) {
    if (buffer[i] === 0xff && (buffer[i + 1] === 0xc0 || buffer[i + 1] === 0xc2)) {
      const height = buffer.readUInt16BE(i + 5);
      const width = buffer.readUInt16BE(i + 7);
      return { width, height };
    }
  }
  return null;
}

async function runTests() {
  console.log('===============================================================');
  console.log('CHALLENGER 2 EMPIRICAL TEST SUITE — MILESTONE 1');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // TEST SECTION 1: exifr parsing of all 6 sample captures
  // --------------------------------------------------------------------------
  console.log('--- SECTION 1: Sample Captures EXIF & Dimension Verification ---');

  for (const expected of SAMPLE_CAPTURES) {
    const fullPath = path.resolve(process.cwd(), expected.filePath);
    const fileExists = fs.existsSync(fullPath);
    assert(fileExists, `File exists: ${expected.filePath}`);
    if (!fileExists) continue;

    const fileBuf = fs.readFileSync(fullPath);
    const parsedExif = await exifr.parse(fullPath);

    assert(Boolean(parsedExif), `exifr parsed successfully: ${expected.filePath}`);
    if (!parsedExif) continue;

    // Check Make
    assert(
      parsedExif.Make === expected.make,
      `[${expected.filePath}] Make matches`,
      `Expected "${expected.make}", got "${parsedExif.Make}"`
    );

    // Check Model
    assert(
      parsedExif.Model === expected.model,
      `[${expected.filePath}] Model matches`,
      `Expected "${expected.model}", got "${parsedExif.Model}"`
    );

    // Check LensModel
    assert(
      parsedExif.LensModel === expected.lensModel,
      `[${expected.filePath}] LensModel matches`,
      `Expected "${expected.lensModel}", got "${parsedExif.LensModel}"`
    );

    // Check FNumber
    assert(
      Math.abs(parsedExif.FNumber - expected.fNumber) < 0.05,
      `[${expected.filePath}] FNumber matches`,
      `Expected ${expected.fNumber}, got ${parsedExif.FNumber}`
    );

    // Check ExposureTime
    const expDiff = Math.abs(parsedExif.ExposureTime - expected.exposureTime);
    assert(
      expDiff < 0.001 || expDiff / expected.exposureTime < 0.05,
      `[${expected.filePath}] ExposureTime matches`,
      `Expected ${expected.exposureTime}, got ${parsedExif.ExposureTime}`
    );

    // Check ISO
    assert(
      parsedExif.ISO === expected.iso,
      `[${expected.filePath}] ISO matches`,
      `Expected ${expected.iso}, got ${parsedExif.ISO}`
    );

    // Check FocalLength
    assert(
      parsedExif.FocalLength === expected.focalLength,
      `[${expected.filePath}] FocalLength matches`,
      `Expected ${expected.focalLength}, got ${parsedExif.FocalLength}`
    );

    // Check Dimensions via SOF0 header
    const sof0 = getJpegSof0Dimensions(fileBuf);
    assert(
      Boolean(sof0),
      `[${expected.filePath}] SOF0 marker present in JPEG binary`,
      `Found SOF0: ${JSON.stringify(sof0)}`
    );

    if (sof0) {
      assert(
        sof0.width === expected.width && sof0.height === expected.height,
        `[${expected.filePath}] Binary SOF0 dimensions match expected`,
        `Expected ${expected.width}x${expected.height}, got ${sof0.width}x${sof0.height}`
      );
    }

    // Check whether exifr alone returned dimensions
    const exifrWidth = parsedExif.ExifImageWidth ?? parsedExif.ImageWidth ?? parsedExif.width;
    const exifrHeight = parsedExif.ExifImageHeight ?? parsedExif.ImageHeight ?? parsedExif.height;
    console.log(
      `  -> ${expected.filePath}: Make="${parsedExif.Make}", Model="${parsedExif.Model}", ` +
      `f/${parsedExif.FNumber}, exp=${parsedExif.ExposureTime}, ISO=${parsedExif.ISO}, ` +
      `SOF0=${sof0?.width}x${sof0?.height}, exifrDims=${exifrWidth}x${exifrHeight}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST SECTION 2: rowToCapture & captureToRow robustness
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 2: rowToCapture & captureToRow Stress-Tests ---');

  const baseRow: CaptureRow = {
    id: 'test-uuid-1',
    slug: 'brutalist-atrium-01',
    title: 'Brutalist Concrete Atrium',
    story: 'An impressive study in concrete and shadow.',
    collection_slug: 'architecture',
    r2_key: 'captures/architecture/brutalist-atrium-01.jpg',
    image_url: '/api/media/captures/architecture/brutalist-atrium-01.jpg',
    width: 3840,
    height: 2560,
    aspect_ratio: 1.5,
    location: 'London, UK',
    captured_at: '2026-02-14T11:30:00Z',
    camera_model: 'Leica Q2',
    lens_model: 'Summilux 28mm f/1.7 ASPH',
    focal_length: '28mm',
    aperture: 'f/2.8',
    shutter_speed: '1/250s',
    iso: 100,
    tags_json: '["architecture", "concrete", "monochrome"]',
    featured: 1,
    created_at: '2026-03-01T10:00:00Z'
  };

  // Case 2.1: Valid row conversion
  const c1 = rowToCapture(baseRow);
  assert(
    Array.isArray(c1.tags) && c1.tags.length === 3 && c1.tags[0] === 'architecture',
    'rowToCapture: parses valid JSON tags array'
  );
  assert(c1.featured === true, 'rowToCapture: converts featured=1 to boolean true');
  assert(c1.id === baseRow.id && c1.slug === baseRow.slug, 'rowToCapture: preserves core fields');

  // Case 2.2: featured=0 conversion
  const c2 = rowToCapture({ ...baseRow, featured: 0 });
  assert(c2.featured === false, 'rowToCapture: converts featured=0 to boolean false');

  // Case 2.3: Empty array tags_json
  const c3 = rowToCapture({ ...baseRow, tags_json: '[]' });
  assert(Array.isArray(c3.tags) && c3.tags.length === 0, 'rowToCapture: handles empty JSON array "[]"');

  // Case 2.4: Empty string tags_json
  const c4 = rowToCapture({ ...baseRow, tags_json: '' });
  assert(Array.isArray(c4.tags) && c4.tags.length === 0, 'rowToCapture: handles empty string tags_json gracefully');

  // Case 2.5: Corrupted syntax in tags_json
  const c5 = rowToCapture({ ...baseRow, tags_json: '{"invalid: syntax[' });
  assert(Array.isArray(c5.tags) && c5.tags.length === 0, 'rowToCapture: handles corrupted JSON without throwing');

  // Case 2.6: Non-array JSON object in tags_json
  const c6 = rowToCapture({ ...baseRow, tags_json: '{"tag1": "value"}' });
  assert(Array.isArray(c6.tags) && c6.tags.length === 0, 'rowToCapture: non-array object JSON falls back to empty array');

  // Case 2.7: Primitive number JSON in tags_json
  const c7 = rowToCapture({ ...baseRow, tags_json: '12345' });
  assert(Array.isArray(c7.tags) && c7.tags.length === 0, 'rowToCapture: primitive number JSON falls back to empty array');

  // Case 2.8: "null" JSON in tags_json
  const c8 = rowToCapture({ ...baseRow, tags_json: 'null' });
  assert(Array.isArray(c8.tags) && c8.tags.length === 0, 'rowToCapture: "null" JSON falls back to empty array');

  // Case 2.9: captureToRow with tags and featured
  const partialCapture: Partial<Capture> = {
    title: 'New Capture',
    tags: ['street', 'night'],
    featured: true
  };
  const r1 = captureToRow(partialCapture);
  assert(r1.tags_json === '["street","night"]', 'captureToRow: serializes tags array to JSON string');
  assert(r1.featured === 1, 'captureToRow: converts featured=true to 1');
  assert(!('tags' in r1), 'captureToRow: removes tags property from resulting row');

  // Case 2.10: captureToRow with featured=false and empty tags
  const r2 = captureToRow({ tags: [], featured: false });
  assert(r2.tags_json === '[]', 'captureToRow: serializes empty tags array to "[]"');
  assert(r2.featured === 0, 'captureToRow: converts featured=false to 0');

  // Case 2.11: captureToRow round-trip
  const roundTripCapture = rowToCapture(baseRow);
  const backToRow = captureToRow(roundTripCapture) as CaptureRow;
  assert(
    backToRow.tags_json === JSON.stringify(baseRow.tags_json ? JSON.parse(baseRow.tags_json) : []),
    'captureToRow round-trip: tags serialize identically'
  );
  assert(backToRow.featured === baseRow.featured, 'captureToRow round-trip: featured flag round-trips');

  // --------------------------------------------------------------------------
  // TEST SECTION 3: Telemetry Formatters Stress-Tests
  // --------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Telemetry Formatters Stress-Tests ---');

  // formatAperture
  assert(formatAperture(2.8) === 'f/2.8', 'formatAperture: 2.8 -> "f/2.8"');
  assert(formatAperture(8.0) === 'f/8', 'formatAperture: 8.0 -> "f/8" (trailing .0 stripped)');
  assert(formatAperture(1.4) === 'f/1.4', 'formatAperture: 1.4 -> "f/1.4"');
  assert(formatAperture(5.6) === 'f/5.6', 'formatAperture: 5.6 -> "f/5.6"');
  assert(formatAperture('f/2.8') === 'f/2.8', 'formatAperture: "f/2.8" -> "f/2.8"');
  assert(formatAperture('2.8') === 'f/2.8', 'formatAperture: "2.8" -> "f/2.8"');
  assert(formatAperture(null) === '—', 'formatAperture: null -> "—"');
  assert(formatAperture(undefined) === '—', 'formatAperture: undefined -> "—"');
  assert(formatAperture('') === '—', 'formatAperture: "" -> "—"');

  // formatShutterSpeed
  assert(formatShutterSpeed(0.002) === '1/500s', 'formatShutterSpeed: 0.002 -> "1/500s"');
  assert(formatShutterSpeed(0.004) === '1/250s', 'formatShutterSpeed: 0.004 -> "1/250s"');
  assert(formatShutterSpeed(0.008) === '1/125s', 'formatShutterSpeed: 0.008 -> "1/125s"');
  assert(formatShutterSpeed(0.0166) === '1/60s', 'formatShutterSpeed: 0.0166 -> "1/60s"');
  assert(formatShutterSpeed(0.25) === '1/4s', 'formatShutterSpeed: 0.25 -> "1/4s"');
  assert(formatShutterSpeed(1) === '1s', 'formatShutterSpeed: 1 -> "1s"');
  assert(formatShutterSpeed(2.5) === '2.5s', 'formatShutterSpeed: 2.5 -> "2.5s"');
  assert(formatShutterSpeed('1/500s') === '1/500s', 'formatShutterSpeed: "1/500s" -> "1/500s"');
  assert(formatShutterSpeed('1/250') === '1/250s', 'formatShutterSpeed: "1/250" -> "1/250s"');
  assert(formatShutterSpeed(null) === '—', 'formatShutterSpeed: null -> "—"');
  assert(formatShutterSpeed(undefined) === '—', 'formatShutterSpeed: undefined -> "—"');
  assert(formatShutterSpeed('') === '—', 'formatShutterSpeed: "" -> "—"');

  // formatFocalLength
  assert(formatFocalLength(28) === '28mm', 'formatFocalLength: 28 -> "28mm"');
  assert(formatFocalLength(33) === '33mm', 'formatFocalLength: 33 -> "33mm"');
  assert(formatFocalLength(55.2) === '55mm', 'formatFocalLength: 55.2 -> "55mm"');
  assert(formatFocalLength('28mm') === '28mm', 'formatFocalLength: "28mm" -> "28mm"');
  assert(formatFocalLength('50') === '50mm', 'formatFocalLength: "50" -> "50mm"');
  assert(formatFocalLength(null) === '—', 'formatFocalLength: null -> "—"');
  assert(formatFocalLength(undefined) === '—', 'formatFocalLength: undefined -> "—"');
  assert(formatFocalLength('') === '—', 'formatFocalLength: "" -> "—"');

  // formatIso
  assert(formatIso(100) === 'ISO 100', 'formatIso: 100 -> "ISO 100"');
  assert(formatIso(800) === 'ISO 800', 'formatIso: 800 -> "ISO 800"');
  assert(formatIso(1600) === 'ISO 1600', 'formatIso: 1600 -> "ISO 1600"');
  assert(formatIso('3200') === 'ISO 3200', 'formatIso: "3200" -> "ISO 3200"');
  assert(formatIso(null) === '—', 'formatIso: null -> "—"');
  assert(formatIso(undefined) === '—', 'formatIso: undefined -> "—"');
  assert(formatIso('') === '—', 'formatIso: "" -> "—"');

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);

  if (failedCount > 0) {
    console.error('\nFAILED TESTS:');
    for (const r of results.filter((r) => !r.passed)) {
      console.error(`❌ ${r.name}: ${r.details || r.error}`);
    }
    process.exit(1);
  } else {
    console.log('✅ ALL EMPIRICAL CHALLENGES PASSED SUCCESSFULLY');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
