/**
 * scripts/generate-sample-captures.ts
 *
 * Generates lightweight, authentic EXIF JPEG fixtures in ./captures/
 * for local CLI sync dry-runs (npm run sync -- --dry-run) and offline testing.
 *
 * Each image is ~350–450 bytes, valid according to JPEG (ISO/IEC 10918-1)
 * and EXIF 2.31 / TIFF 6.0 standards, fully parsable by exifr.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface ExifFixtureConfig {
  filePath: string;
  width: number;
  height: number;
  make: string;
  model: string;
  lensModel: string;
  focalLength: number; // in mm
  fNumber: number; // e.g. 1.4
  exposureTime: number; // e.g. 0.002 for 1/500
  iso: number;
  dateTimeOriginal: string; // 'YYYY:MM:DD HH:MM:SS'
}

export function buildExifJpeg(config: ExifFixtureConfig): Buffer {
  const {
    width,
    height,
    make,
    model,
    lensModel,
    focalLength,
    fNumber,
    exposureTime,
    iso,
    dateTimeOriginal
  } = config;

  function writeAscii(str: string): Buffer {
    return Buffer.from(str + '\0', 'utf8');
  }

  function createRational(num: number, den: number): Buffer {
    const buf = Buffer.alloc(8);
    buf.writeUInt32LE(num, 0);
    buf.writeUInt32LE(den, 4);
    return buf;
  }

  const makeBuf = writeAscii(make);
  const modelBuf = writeAscii(model);
  const lensBuf = writeAscii(lensModel);
  const dateBuf = writeAscii(dateTimeOriginal);

  const expNum = 1;
  const expDen = Math.max(1, Math.round(1 / exposureTime));
  const expBuf = createRational(expNum, expDen);

  const fNum = Math.round(fNumber * 10);
  const fDen = 10;
  const fBuf = createRational(fNum, fDen);

  const focalBuf = createRational(Math.round(focalLength), 1);

  // Layout offsets:
  // TIFF Header: 8 bytes (0-7)
  // IFD0: 42 bytes (8-49)
  // Exif SubIFD: 78 bytes (50-127)
  // Dynamic data pool: starts at offset 128
  const ifd0Offset = 8;
  const subIfdOffset = 50;
  let currentDataOffset = 128;

  function allocData(buf: Buffer) {
    const offset = currentDataOffset;
    currentDataOffset += buf.length;
    if (currentDataOffset % 2 !== 0) currentDataOffset++;
    return { offset, buf };
  }

  const makeAlloc = allocData(makeBuf);
  const modelAlloc = allocData(modelBuf);
  const expAlloc = allocData(expBuf);
  const fAlloc = allocData(fBuf);
  const dateAlloc = allocData(dateBuf);
  const focalAlloc = allocData(focalBuf);
  const lensAlloc = allocData(lensBuf);

  const tiff = Buffer.alloc(currentDataOffset);

  // TIFF Header (Little Endian 'II', 0x002A, offset 8)
  tiff[0] = 0x49; tiff[1] = 0x49;
  tiff.writeUInt16LE(0x002a, 2);
  tiff.writeUInt32LE(ifd0Offset, 4);

  // IFD0: 3 tags
  let p = ifd0Offset;
  tiff.writeUInt16LE(3, p); p += 2;

  // Make (0x010F), ASCII
  tiff.writeUInt16LE(0x010f, p); p += 2;
  tiff.writeUInt16LE(2, p); p += 2;
  tiff.writeUInt32LE(makeBuf.length, p); p += 4;
  tiff.writeUInt32LE(makeAlloc.offset, p); p += 4;

  // Model (0x0110), ASCII
  tiff.writeUInt16LE(0x0110, p); p += 2;
  tiff.writeUInt16LE(2, p); p += 2;
  tiff.writeUInt32LE(modelBuf.length, p); p += 4;
  tiff.writeUInt32LE(modelAlloc.offset, p); p += 4;

  // ExifIFDPointer (0x8769), LONG
  tiff.writeUInt16LE(0x8769, p); p += 2;
  tiff.writeUInt16LE(4, p); p += 2;
  tiff.writeUInt32LE(1, p); p += 4;
  tiff.writeUInt32LE(subIfdOffset, p); p += 4;

  // Next IFD = 0
  tiff.writeUInt32LE(0, p); p += 4;

  // Exif SubIFD: 6 tags
  p = subIfdOffset;
  tiff.writeUInt16LE(6, p); p += 2;

  // ExposureTime (0x829A), RATIONAL
  tiff.writeUInt16LE(0x829a, p); p += 2;
  tiff.writeUInt16LE(5, p); p += 2;
  tiff.writeUInt32LE(1, p); p += 4;
  tiff.writeUInt32LE(expAlloc.offset, p); p += 4;

  // FNumber (0x829D), RATIONAL
  tiff.writeUInt16LE(0x829d, p); p += 2;
  tiff.writeUInt16LE(5, p); p += 2;
  tiff.writeUInt32LE(1, p); p += 4;
  tiff.writeUInt32LE(fAlloc.offset, p); p += 4;

  // ISO (0x8827), SHORT (inlined)
  tiff.writeUInt16LE(0x8827, p); p += 2;
  tiff.writeUInt16LE(3, p); p += 2;
  tiff.writeUInt32LE(1, p); p += 4;
  tiff.writeUInt16LE(iso, p); p += 4;

  // DateTimeOriginal (0x9003), ASCII
  tiff.writeUInt16LE(0x9003, p); p += 2;
  tiff.writeUInt16LE(2, p); p += 2;
  tiff.writeUInt32LE(dateBuf.length, p); p += 4;
  tiff.writeUInt32LE(dateAlloc.offset, p); p += 4;

  // FocalLength (0x920A), RATIONAL
  tiff.writeUInt16LE(0x920a, p); p += 2;
  tiff.writeUInt16LE(5, p); p += 2;
  tiff.writeUInt32LE(1, p); p += 4;
  tiff.writeUInt32LE(focalAlloc.offset, p); p += 4;

  // LensModel (0xA434), ASCII
  tiff.writeUInt16LE(0xa434, p); p += 2;
  tiff.writeUInt16LE(2, p); p += 2;
  tiff.writeUInt32LE(lensBuf.length, p); p += 4;
  tiff.writeUInt32LE(lensAlloc.offset, p); p += 4;

  // Next SubIFD = 0
  tiff.writeUInt32LE(0, p); p += 4;

  // Copy allocated strings/rationals into TIFF buffer
  makeAlloc.buf.copy(tiff, makeAlloc.offset);
  modelAlloc.buf.copy(tiff, modelAlloc.offset);
  expAlloc.buf.copy(tiff, expAlloc.offset);
  fAlloc.buf.copy(tiff, fAlloc.offset);
  dateAlloc.buf.copy(tiff, dateAlloc.offset);
  focalAlloc.buf.copy(tiff, focalAlloc.offset);
  lensAlloc.buf.copy(tiff, lensAlloc.offset);

  // JPEG Markers
  const soi = Buffer.from([0xff, 0xd8]);
  const app1Header = Buffer.from([0xff, 0xe1]);
  const app1LengthBuf = Buffer.alloc(2);
  app1LengthBuf.writeUInt16BE(2 + 6 + tiff.length, 0);
  const exifMarker = Buffer.from('Exif\0\0', 'binary');

  // DQT
  const dqt = Buffer.from([
    0xff, 0xdb, 0x00, 0x43, 0x00,
    ...Array(64).fill(1)
  ]);

  // SOF0 (Frame dimensions)
  const sof0 = Buffer.alloc(19);
  sof0[0] = 0xff;
  sof0[1] = 0xc0;
  sof0.writeUInt16BE(17, 2);
  sof0[4] = 8;
  sof0.writeUInt16BE(height, 5);
  sof0.writeUInt16BE(width, 7);
  sof0[9] = 3;
  sof0[10] = 1; sof0[11] = 0x11; sof0[12] = 0;
  sof0[13] = 2; sof0[14] = 0x11; sof0[15] = 0;
  sof0[16] = 3; sof0[17] = 0x11; sof0[18] = 0;

  // DHT
  const dht = Buffer.from([
    0xff, 0xc4, 0x00, 0x1f, 0x00,
    0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b
  ]);

  // SOS
  const sos = Buffer.from([
    0xff, 0xda, 0x00, 0x0c, 0x03,
    0x01, 0x00, 0x02, 0x11, 0x03, 0x11,
    0x00, 0x3f, 0x00
  ]);

  const scanData = Buffer.from([0x00]);
  const eoi = Buffer.from([0xff, 0xd9]);

  return Buffer.concat([
    soi,
    app1Header,
    app1LengthBuf,
    exifMarker,
    tiff,
    dqt,
    sof0,
    dht,
    sos,
    scanData,
    eoi
  ]);
}

export const SAMPLE_CAPTURES: ExifFixtureConfig[] = [
  {
    filePath: 'captures/architecture/brutalist-atrium-01.jpg',
    width: 3840,
    height: 2560,
    make: 'Leica Camera AG',
    model: 'Leica Q2',
    lensModel: 'Summilux 28mm f/1.7 ASPH',
    focalLength: 28,
    fNumber: 2.8,
    exposureTime: 0.004, // 1/250s
    iso: 100,
    dateTimeOriginal: '2026:02:14 11:30:00'
  },
  {
    filePath: 'captures/architecture/spiral-concrete-stairs.jpg',
    width: 2560,
    height: 3840,
    make: 'SONY',
    model: 'Sony A7R V',
    lensModel: 'FE 24-70mm f/2.8 GM II',
    focalLength: 24,
    fNumber: 8.0,
    exposureTime: 0.0166, // 1/60s
    iso: 200,
    dateTimeOriginal: '2026:02:18 15:45:00'
  },
  {
    filePath: 'captures/street/shibuya-rain-reflections.jpg',
    width: 3840,
    height: 2560,
    make: 'FUJIFILM',
    model: 'Fujifilm X-T5',
    lensModel: 'Fujinon XF 33mm f/1.4 R LM WR',
    focalLength: 33,
    fNumber: 1.4,
    exposureTime: 0.002, // 1/500s
    iso: 800,
    dateTimeOriginal: '2026:03:01 21:15:00'
  },
  {
    filePath: 'captures/street/night-market-neon.jpg',
    width: 3000,
    height: 3000,
    make: 'Leica Camera AG',
    model: 'Leica Q2',
    lensModel: 'Summilux 28mm f/1.7 ASPH',
    focalLength: 28,
    fNumber: 2.0,
    exposureTime: 0.008, // 1/125s
    iso: 1600,
    dateTimeOriginal: '2026:03:05 22:40:00'
  },
  {
    filePath: 'captures/minimalism/mist-over-lake-biwa.jpg',
    width: 3840,
    height: 2160,
    make: 'Hasselblad',
    model: 'Hasselblad 907X 50C',
    lensModel: 'XCD 45mm f/4 P',
    focalLength: 45,
    fNumber: 8.0,
    exposureTime: 0.25, // 1/4s
    iso: 100,
    dateTimeOriginal: '2026:03:10 06:10:00'
  },
  {
    filePath: 'captures/minimalism/solitary-pine-ridge.jpg',
    width: 2560,
    height: 3840,
    make: 'FUJIFILM',
    model: 'Fujifilm X-T5',
    lensModel: 'Fujinon XF 16-55mm f/2.8 R LM WR',
    focalLength: 55,
    fNumber: 5.6,
    exposureTime: 0.001, // 1/1000s
    iso: 125,
    dateTimeOriginal: '2026:03:12 09:20:00'
  }
];

export function generateAllSampleCaptures(
  projectRoot = process.cwd(),
  silent = false
): void {
  for (const config of SAMPLE_CAPTURES) {
    const fullPath = path.resolve(projectRoot, config.filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const jpegBuffer = buildExifJpeg(config);
    fs.writeFileSync(fullPath, jpegBuffer);
    if (!silent) {
      console.log(`Generated: ${config.filePath} (${jpegBuffer.length} bytes)`);
    }
  }
}

// Auto-run when executed directly via CLI
const isMain = process.argv[1] && process.argv[1].includes('generate-sample-captures');
if (isMain) {
  generateAllSampleCaptures();
}
