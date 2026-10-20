/**
 * src/test/setup.ts
 *
 * Vitest + Testing Library setup, navigator.clipboard mock, and JSDOM polyfills
 * for HTMLDialogElement and matchMedia.
 */

import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Polyfill HTMLDialogElement
if (typeof HTMLDialogElement !== 'undefined') {
  if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
  }

  if (typeof HTMLDialogElement.prototype.close !== 'function') {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}

// Polyfill matchMedia
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// Mock navigator.clipboard
if (typeof navigator !== 'undefined') {
  if (!navigator.clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
        readText: vi.fn().mockResolvedValue(''),
      },
      writable: true,
      configurable: true,
    });
  } else if (!navigator.clipboard.writeText) {
    navigator.clipboard.writeText = vi.fn().mockResolvedValue(undefined);
  }
}
