import { describe, it, expect } from 'vitest';
import {
  rowToCapture,
  captureToRow,
  formatAperture,
  formatShutterSpeed,
  formatFocalLength,
  formatIso,
  Capture,
  CaptureRow
} from '../types/gallery';

describe('Adversarial Stress Testing — src/types/gallery.ts', () => {
  const baseValidRow: CaptureRow = {
    id: 'c1234567-89ab-cdef-0123-456789abcdef',
    slug: 'tokyo-shinjuku-crossing',
    title: 'Rain over Shinjuku',
    story: 'Wet neon reflections during a rainy evening in Shinjuku.',
    collection_slug: 'street',
    r2_key: 'captures/street/shinjuku.webp',
    image_url: '/api/media/captures/street/shinjuku.webp',
    width: 6000,
    height: 4000,
    aspect_ratio: 1.5,
    location: 'Shinjuku, Tokyo, Japan',
    captured_at: '2026-03-15T19:30:00Z',
    camera_model: 'Fujifilm X-T5',
    lens_model: 'Fujinon XF 33mm f/1.4 R LM WR',
    focal_length: '33mm',
    aperture: 'f/1.4',
    shutter_speed: '1/250s',
    iso: 800,
    tags_json: '["street", "tokyo", "rain", "neon"]',
    featured: 1,
    created_at: '2026-03-16T10:00:00Z'
  };

  describe('1. rowToCapture Payload Fuzzing & tags_json Stripping', () => {
    it('always strictly excludes tags_json from the returned object across valid vectors', () => {
      const result = rowToCapture(baseValidRow);

      // Verify tags_json is NOT present in any form
      expect('tags_json' in result).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(result, 'tags_json')).toBe(false);
      expect(Object.keys(result)).not.toContain('tags_json');
      expect((result as unknown as Record<string, unknown>).tags_json).toBeUndefined();

      // Verify tags parsed properly
      expect(result.tags).toEqual(['street', 'tokyo', 'rain', 'neon']);
      expect(result.featured).toBe(true);
    });

    const maliciousAndMalformedVectors = [
      { name: 'empty string', value: '' },
      { name: 'whitespace string', value: '   ' },
      { name: 'null literal JSON', value: 'null' },
      { name: 'boolean true JSON', value: 'true' },
      { name: 'boolean false JSON', value: 'false' },
      { name: 'number literal JSON', value: '12345' },
      { name: 'string literal JSON (not array)', value: '"just a string"' },
      { name: 'plain object JSON (not array)', value: '{"key": "value", "tags": [1,2,3]}' },
      { name: 'corrupted unclosed array JSON', value: '["broken", "unclosed"' },
      { name: 'corrupted syntax JSON', value: '{bad syntax}' },
      { name: 'JavaScript undefined keyword', value: 'undefined' },
      { name: 'JavaScript NaN keyword', value: 'NaN' },
      { name: 'SQL injection payload', value: "'; DROP TABLE captures; --" },
      { name: 'HTML script injection payload', value: '<script>alert("xss")</script>' },
      { name: 'prototype pollution payload object', value: '{"__proto__": {"polluted": true}}' },
      { name: 'array with mixed types', value: '["valid", 123, true, null, {"nested": false}]' },
      { name: 'empty JSON array', value: '[]' },
      { name: 'null value (type-coerced)', value: null as unknown as string },
      { name: 'undefined value (type-coerced)', value: undefined as unknown as string },
      { name: 'numeric value (type-coerced)', value: 9999 as unknown as string },
      { name: 'boolean value (type-coerced)', value: false as unknown as string }
    ];

    for (const vector of maliciousAndMalformedVectors) {
      it(`handles vector [${vector.name}] safely and strips tags_json`, () => {
        const testRow: CaptureRow = {
          ...baseValidRow,
          tags_json: vector.value
        };

        const result = rowToCapture(testRow);

        // Core assertions
        expect('tags_json' in result).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(result, 'tags_json')).toBe(false);
        expect(Object.keys(result)).not.toContain('tags_json');
        expect(Array.isArray(result.tags)).toBe(true);
        expect(typeof result.featured).toBe('boolean');
      });
    }

    it('handles unicode, emoji, and escape characters in tags_json safely', () => {
      const unicodeRow: CaptureRow = {
        ...baseValidRow,
        tags_json: JSON.stringify(['📸 photography', '東京', 'café & bar', 'null\u0000byte', 'line\nbreak', 'tab\t'])
      };

      const result = rowToCapture(unicodeRow);

      expect('tags_json' in result).toBe(false);
      expect(result.tags).toHaveLength(6);
      expect(result.tags[0]).toBe('📸 photography');
      expect(result.tags[1]).toBe('東京');
      expect(result.tags[2]).toBe('café & bar');
    });

    it('handles high volume fuzzing with 200 random adversarial inputs without crashing', () => {
      const fuzzJunk = [
        '',
        '   ',
        '[]',
        '{}',
        'null',
        'true',
        'false',
        '0',
        '9999999',
        '-1',
        'NaN',
        'Infinity',
        '-Infinity',
        'undefined',
        '{"a":1}',
        '["a","b"]',
        '["\\u0000"]',
        '[1,2,3]',
        '{"__proto__":1}',
        '{"constructor":2}',
        '["\' OR 1=1 --"]',
        '["<img src=x onerror=alert(1)>"]',
        '{"tags_json": "nested"}',
        '[,,,,,,]',
        '{"length": 1000}',
        'String.fromCharCode(65)',
        'Object.create(null)',
        '{"nested": {"deep": [null, true, "string"]}}'
      ];

      for (let i = 0; i < 200; i++) {
        const randomString = fuzzJunk[i % fuzzJunk.length] + (i > 100 ? String(Math.random()) : '');
        const fuzzedRow: CaptureRow = {
          ...baseValidRow,
          id: `fuzz-${i}`,
          tags_json: randomString,
          featured: i % 2
        };

        const result = rowToCapture(fuzzedRow);

        expect('tags_json' in result).toBe(false);
        expect(Object.prototype.hasOwnProperty.call(result, 'tags_json')).toBe(false);
        expect(Array.isArray(result.tags)).toBe(true);
        expect(result.featured).toBe(i % 2 === 1);
      }
    });

    it('does not inherit tags_json even if row prototype has tags_json property', () => {
      const proto = { tags_json: '["prototype_leak"]' };
      const rowWithProto = Object.assign(Object.create(proto), baseValidRow, {
        tags_json: '["own_tags"]'
      });

      const result = rowToCapture(rowWithProto);

      expect('tags_json' in result).toBe(false);
      expect(result.tags).toEqual(['own_tags']);
    });
  });

  describe('2. Round-Trip Integrity: rowToCapture <-> captureToRow', () => {
    it('preserves full fidelity when converting row -> capture -> row', () => {
      const originalRow: CaptureRow = {
        ...baseValidRow,
        tags_json: JSON.stringify(['monochrome', 'architecture', 'glass']),
        featured: 1
      };

      const capture = rowToCapture(originalRow);

      expect('tags_json' in capture).toBe(false);
      expect(capture.tags).toEqual(['monochrome', 'architecture', 'glass']);
      expect(capture.featured).toBe(true);

      const roundTrippedRow = captureToRow(capture) as CaptureRow;

      // Ensure 'tags' domain field was converted to 'tags_json'
      expect('tags' in roundTrippedRow).toBe(false);
      expect('tags_json' in roundTrippedRow).toBe(true);
      expect(JSON.parse(roundTrippedRow.tags_json)).toEqual(['monochrome', 'architecture', 'glass']);
      expect(roundTrippedRow.featured).toBe(1);

      // Verify all scalar properties match exactly
      expect(roundTrippedRow.id).toBe(originalRow.id);
      expect(roundTrippedRow.slug).toBe(originalRow.slug);
      expect(roundTrippedRow.title).toBe(originalRow.title);
      expect(roundTrippedRow.story).toBe(originalRow.story);
      expect(roundTrippedRow.collection_slug).toBe(originalRow.collection_slug);
      expect(roundTrippedRow.r2_key).toBe(originalRow.r2_key);
      expect(roundTrippedRow.image_url).toBe(originalRow.image_url);
      expect(roundTrippedRow.width).toBe(originalRow.width);
      expect(roundTrippedRow.height).toBe(originalRow.height);
      expect(roundTrippedRow.aspect_ratio).toBe(originalRow.aspect_ratio);
      expect(roundTrippedRow.location).toBe(originalRow.location);
      expect(roundTrippedRow.captured_at).toBe(originalRow.captured_at);
      expect(roundTrippedRow.camera_model).toBe(originalRow.camera_model);
      expect(roundTrippedRow.lens_model).toBe(originalRow.lens_model);
      expect(roundTrippedRow.focal_length).toBe(originalRow.focal_length);
      expect(roundTrippedRow.aperture).toBe(originalRow.aperture);
      expect(roundTrippedRow.shutter_speed).toBe(originalRow.shutter_speed);
      expect(roundTrippedRow.iso).toBe(originalRow.iso);
      expect(roundTrippedRow.created_at).toBe(originalRow.created_at);
    });

    it('preserves full fidelity when converting capture -> row -> capture', () => {
      const originalCapture: Capture = {
        id: 'cap-987',
        slug: 'minimalist-shadow',
        title: 'Minimalist Shadow',
        story: 'Geometric afternoon shadow cast on brutalist concrete.',
        collection_slug: 'minimalism',
        r2_key: 'captures/minimalism/shadow.webp',
        image_url: '/api/media/captures/minimalism/shadow.webp',
        width: 4000,
        height: 6000,
        aspect_ratio: 0.67,
        location: 'Berlin, Germany',
        captured_at: '2026-02-10T15:00:00Z',
        camera_model: 'Leica Q2',
        lens_model: 'Summilux 28mm f/1.7 ASPH',
        focal_length: '28mm',
        aperture: 'f/2.8',
        shutter_speed: '1/1000s',
        iso: 100,
        tags: ['minimalism', 'shadow', 'concrete'],
        featured: false,
        created_at: '2026-02-11T09:00:00Z'
      };

      const row = captureToRow(originalCapture) as CaptureRow;

      expect('tags' in row).toBe(false);
      expect(row.tags_json).toBe(JSON.stringify(['minimalism', 'shadow', 'concrete']));
      expect(row.featured).toBe(0);

      const roundTrippedCapture = rowToCapture(row);

      expect('tags_json' in roundTrippedCapture).toBe(false);
      expect(roundTrippedCapture).toEqual(originalCapture);
    });

    it('handles partial capture payloads cleanly in captureToRow', () => {
      const partialUpdate = {
        title: 'Updated Title',
        tags: ['new-tag-1', 'new-tag-2'],
        featured: true
      };

      const row = captureToRow(partialUpdate);

      expect(row.title).toBe('Updated Title');
      expect(row.tags_json).toBe(JSON.stringify(['new-tag-1', 'new-tag-2']));
      expect(row.featured).toBe(1);
      expect('tags' in row).toBe(false);
    });
  });

  describe('3. EXIF Telemetry Formatters Stress Testing', () => {
    describe('formatAperture', () => {
      it('formats standard numeric f-numbers accurately', () => {
        expect(formatAperture(1.4)).toBe('f/1.4');
        expect(formatAperture(2.8)).toBe('f/2.8');
        expect(formatAperture(5.6)).toBe('f/5.6');
        expect(formatAperture(1.8)).toBe('f/1.8');
      });

      it('strips redundant trailing .0 for whole integer apertures', () => {
        expect(formatAperture(1)).toBe('f/1');
        expect(formatAperture(2)).toBe('f/2');
        expect(formatAperture(4)).toBe('f/4');
        expect(formatAperture(8)).toBe('f/8');
        expect(formatAperture(11)).toBe('f/11');
      });

      it('preserves or standardizes string aperture formats', () => {
        expect(formatAperture('f/1.4')).toBe('f/1.4');
        expect(formatAperture('1.4')).toBe('f/1.4');
        expect(formatAperture('f/2.8')).toBe('f/2.8');
        expect(formatAperture('f/11')).toBe('f/11');
      });

      it('returns em-dash for null, undefined, or empty string', () => {
        expect(formatAperture(null)).toBe('—');
        expect(formatAperture(undefined)).toBe('—');
        expect(formatAperture('')).toBe('—');
      });

      it('handles unusual boundary numbers without throwing', () => {
        expect(formatAperture(0)).toBe('f/0');
        expect(formatAperture(128)).toBe('f/128');
        expect(formatAperture(1.414)).toBe('f/1.4');
      });
    });

    describe('formatShutterSpeed', () => {
      it('formats sub-second fractions accurately with denominator calculation', () => {
        expect(formatShutterSpeed(1 / 500)).toBe('1/500s');
        expect(formatShutterSpeed(1 / 250)).toBe('1/250s');
        expect(formatShutterSpeed(1 / 1000)).toBe('1/1000s');
        expect(formatShutterSpeed(1 / 8000)).toBe('1/8000s');
        expect(formatShutterSpeed(0.5)).toBe('1/2s');
        expect(formatShutterSpeed(0.25)).toBe('1/4s');
        expect(formatShutterSpeed(0.002)).toBe('1/500s');
      });

      it('formats whole-second and multi-second exposures', () => {
        expect(formatShutterSpeed(1)).toBe('1s');
        expect(formatShutterSpeed(2)).toBe('2s');
        expect(formatShutterSpeed(10)).toBe('10s');
        expect(formatShutterSpeed(30)).toBe('30s');
        expect(formatShutterSpeed(1.5)).toBe('1.5s');
      });

      it('preserves or appends "s" to string shutter speed values', () => {
        expect(formatShutterSpeed('1/500s')).toBe('1/500s');
        expect(formatShutterSpeed('1/500')).toBe('1/500s');
        expect(formatShutterSpeed('30s')).toBe('30s');
        expect(formatShutterSpeed('30')).toBe('30s');
        expect(formatShutterSpeed('1/4000s')).toBe('1/4000s');
      });

      it('returns em-dash for null, undefined, or empty string', () => {
        expect(formatShutterSpeed(null)).toBe('—');
        expect(formatShutterSpeed(undefined)).toBe('—');
        expect(formatShutterSpeed('')).toBe('—');
      });
    });

    describe('formatFocalLength', () => {
      it('formats numeric focal lengths rounded with mm suffix', () => {
        expect(formatFocalLength(35)).toBe('35mm');
        expect(formatFocalLength(50)).toBe('50mm');
        expect(formatFocalLength(85)).toBe('85mm');
        expect(formatFocalLength(33.2)).toBe('33mm');
        expect(formatFocalLength(33.8)).toBe('34mm');
        expect(formatFocalLength(200)).toBe('200mm');
      });

      it('preserves or appends mm to string focal lengths', () => {
        expect(formatFocalLength('35mm')).toBe('35mm');
        expect(formatFocalLength('35')).toBe('35mm');
        expect(formatFocalLength('85mm')).toBe('85mm');
      });

      it('returns em-dash for null, undefined, or empty string', () => {
        expect(formatFocalLength(null)).toBe('—');
        expect(formatFocalLength(undefined)).toBe('—');
        expect(formatFocalLength('')).toBe('—');
      });
    });

    describe('formatIso', () => {
      it('formats numeric and string ISO values with ISO prefix', () => {
        expect(formatIso(100)).toBe('ISO 100');
        expect(formatIso(400)).toBe('ISO 400');
        expect(formatIso(800)).toBe('ISO 800');
        expect(formatIso(1600)).toBe('ISO 1600');
        expect(formatIso(6400)).toBe('ISO 6400');
        expect(formatIso(12800)).toBe('ISO 12800');
        expect(formatIso('400')).toBe('ISO 400');
      });

      it('returns em-dash for null, undefined, or empty string', () => {
        expect(formatIso(null)).toBe('—');
        expect(formatIso(undefined)).toBe('—');
        expect(formatIso('')).toBe('—');
      });
    });
  });
});
