/**
 * src/utils/viewTransitions.ts
 *
 * View Transitions API wrapper with reduced-motion respect and mandatory
 * programmatic accessibility focus routing (modern-web-guidance: same-document-transitions).
 */

import { flushSync } from 'react-dom';

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
};

function focusTargetElement(target?: string | HTMLElement | null): void {
  if (typeof document === 'undefined' || !target) return;
  const el =
    typeof target === 'string'
      ? (document.querySelector(target) as HTMLElement | null)
      : target;
  if (!el) return;
  if (!el.hasAttribute('tabindex')) {
    el.setAttribute('tabindex', '-1');
  }
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
}

/**
 * Wraps a state transition in `document.startViewTransition()` when supported
 * and when the user has not requested reduced motion. Routes focus to the target
 * heading or container after completion to preserve screen-reader context.
 */
export function runViewTransition(
  updateDOM: () => void,
  focusTarget?: string | HTMLElement | null
): void {
  if (typeof document === 'undefined') {
    updateDOM();
    return;
  }

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const doc = document as DocumentWithViewTransition;

  if (prefersReducedMotion || typeof doc.startViewTransition !== 'function') {
    updateDOM();
    // Defer focus slightly so React renders the updated view first
    setTimeout(() => focusTargetElement(focusTarget), 0);
    return;
  }

  try {
    const transition = doc.startViewTransition(() => {
      flushSync(() => {
        updateDOM();
      });
    });
    transition.finished
      .then(() => {
        focusTargetElement(focusTarget);
      })
      .catch(() => {
        focusTargetElement(focusTarget);
      });
  } catch {
    updateDOM();
    setTimeout(() => focusTargetElement(focusTarget), 0);
  }
}
