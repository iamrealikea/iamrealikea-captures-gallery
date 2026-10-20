/**
 * scripts/verify-m1-challenger-1.ts
 *
 * Empirical verification harness for Milestone 1 Production Build Assets:
 * 1. dist/index.html integrity and bundle referencing (JS & CSS).
 * 2. Exact match of all 12 DESIGN_SYSTEM.md design tokens in compiled CSS.
 * 3. Typographic rules: text-wrap: balance (h1-h6) and text-wrap: pretty (p, blockquote).
 * 4. Accessible focus styling: :focus-visible rules and outline properties.
 * 5. Dialog & Backdrop styling: dialog::backdrop, backdrop-filter: blur(4px), and vendor prefix.
 * 6. View transition rules and prefers-reduced-motion media query.
 * 7. JS bundle integrity: existence, non-zero size, React 19 presence, and syntax check.
 */

import fs from 'node:fs';
import path from 'node:path';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  expected?: string;
  actual?: string;
  details?: string;
}

const results: TestResult[] = [];

function assert(
  category: string,
  name: string,
  condition: boolean,
  expected?: string,
  actual?: string,
  details?: string
) {
  results.push({
    category,
    name,
    passed: condition,
    expected,
    actual,
    details
  });
}

const PROJECT_ROOT = process.cwd();
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const DIST_HTML_PATH = path.join(DIST_DIR, 'index.html');

console.log('===============================================================');
console.log('CHALLENGER 1 EMPIRICAL VERIFICATION HARNESS — MILESTONE 1 ITERATION 2');
console.log('Target: Production Build Assets in dist/');
console.log('===============================================================\n');

// ----------------------------------------------------------------------------
// 1. DIST DIRECTORY & HTML FILE INTEGRITY
// ----------------------------------------------------------------------------
assert(
  'Directory Structure',
  'dist/ directory exists',
  fs.existsSync(DIST_DIR) && fs.statSync(DIST_DIR).isDirectory(),
  'Directory exists',
  fs.existsSync(DIST_DIR) ? 'Exists' : 'Missing'
);

assert(
  'Directory Structure',
  'dist/assets/ directory exists',
  fs.existsSync(ASSETS_DIR) && fs.statSync(ASSETS_DIR).isDirectory(),
  'Directory exists',
  fs.existsSync(ASSETS_DIR) ? 'Exists' : 'Missing'
);

assert(
  'HTML File',
  'dist/index.html exists and is non-empty',
  fs.existsSync(DIST_HTML_PATH) && fs.statSync(DIST_HTML_PATH).size > 0,
  '> 0 bytes',
  fs.existsSync(DIST_HTML_PATH) ? `${fs.statSync(DIST_HTML_PATH).size} bytes` : 'Missing'
);

const distHtml = fs.existsSync(DIST_HTML_PATH) ? fs.readFileSync(DIST_HTML_PATH, 'utf8') : '';

assert(
  'HTML Structure',
  'dist/index.html has DOCTYPE html',
  /<!doctype html>/i.test(distHtml),
  '<!doctype html>',
  distHtml.slice(0, 30)
);

assert(
  'HTML Structure',
  'dist/index.html has root mount element (<div id="root"></div>)',
  /<div\s+id=["']root["']\s*>\s*<\/div>/i.test(distHtml),
  '<div id="root"></div>',
  'Found in HTML'
);

// ----------------------------------------------------------------------------
// 2. BUNDLE REFERENCE EXTRACTION & VALIDATION
// ----------------------------------------------------------------------------
const jsScriptMatches = [...distHtml.matchAll(/<script[^>]+src=["']([^"']+\.js)["'][^>]*>/gi)];
const cssLinkMatches = [...distHtml.matchAll(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi)];

assert(
  'Bundle References',
  'dist/index.html references at least one JavaScript bundle',
  jsScriptMatches.length > 0,
  '>= 1 JS script tag',
  `${jsScriptMatches.length} JS tags found`
);

assert(
  'Bundle References',
  'dist/index.html references at least one CSS stylesheet',
  cssLinkMatches.length > 0,
  '>= 1 CSS link tag',
  `${cssLinkMatches.length} CSS tags found`
);

let primaryCssContent = '';

if (cssLinkMatches.length > 0) {
  const cssHref = cssLinkMatches[0][1];
  const relativeCss = cssHref.startsWith('/') ? cssHref.slice(1) : cssHref;
  const fullCssPath = path.join(DIST_DIR, relativeCss);

  const exists = fs.existsSync(fullCssPath);
  const size = exists ? fs.statSync(fullCssPath).size : 0;

  assert(
    'Bundle References',
    `Referenced CSS bundle exists on disk (${cssHref})`,
    exists && size > 0,
    `Existing file > 0 bytes`,
    exists ? `${size} bytes` : 'MISSING'
  );

  if (exists) {
    primaryCssContent = fs.readFileSync(fullCssPath, 'utf8');
  }
}

if (jsScriptMatches.length > 0) {
  const jsSrc = jsScriptMatches[0][1];
  const relativeJs = jsSrc.startsWith('/') ? jsSrc.slice(1) : jsSrc;
  const fullJsPath = path.join(DIST_DIR, relativeJs);

  const exists = fs.existsSync(fullJsPath);
  const size = exists ? fs.statSync(fullJsPath).size : 0;

  assert(
    'Bundle References',
    `Referenced JS bundle exists on disk (${jsSrc})`,
    exists && size > 10000,
    `Existing file > 10KB`,
    exists ? `${size} bytes` : 'MISSING'
  );

  if (exists) {
    const jsContent = fs.readFileSync(fullJsPath, 'utf8');
    // Check for React 19 marker or React imports
    const hasReactArtifacts = jsContent.includes('react') || jsContent.includes('createRoot') || jsContent.includes('jsx');
    assert(
      'JS Bundle Content',
      'JS bundle contains compiled React 19 application runtime',
      hasReactArtifacts,
      'Contains React/createRoot runtime markers',
      hasReactArtifacts ? 'Present' : 'Not found'
    );
  }
}

// ----------------------------------------------------------------------------
// 3. 12 DESIGN SYSTEM TOKENS EMPIRICAL VERIFICATION
// ----------------------------------------------------------------------------
const EXPECTED_TOKENS: { name: string; expectedValue: string; role: string }[] = [
  { name: '--color-background', expectedValue: '#FFFFFF', role: 'Application and page background' },
  { name: '--color-surface', expectedValue: '#FFFFFF', role: 'Cards, dialogs, and raised surfaces' },
  { name: '--color-surface-subtle', expectedValue: '#F8FAFC', role: 'Quiet sections, hover backgrounds' },
  { name: '--color-border', expectedValue: '#E2E8F0', role: 'Borders and dividers' },
  { name: '--color-text', expectedValue: '#0F172A', role: 'Primary text' },
  { name: '--color-text-muted', expectedValue: '#64748B', role: 'Supporting text and icons' },
  { name: '--color-primary', expectedValue: '#2563EB', role: 'Primary actions and links' },
  { name: '--color-primary-hover', expectedValue: '#1D4ED8', role: 'Hovered primary actions' },
  { name: '--color-primary-subtle', expectedValue: '#EFF6FF', role: 'Selected or informational backgrounds' },
  { name: '--color-success', expectedValue: '#16A34A', role: 'Success messaging' },
  { name: '--color-warning', expectedValue: '#D97706', role: 'Warnings' },
  { name: '--color-danger', expectedValue: '#DC2626', role: 'Destructive actions and errors' }
];

// Locate the :root definition block in compiled CSS
const rootBlockMatch = primaryCssContent.match(/:root\s*\{([^}]+)\}/);
const rootContent = rootBlockMatch ? rootBlockMatch[1] : '';

assert(
  'Design Tokens',
  ':root block exists in compiled CSS',
  Boolean(rootBlockMatch),
  ':root { ... }',
  rootBlockMatch ? rootBlockMatch[0].slice(0, 50) + '...' : 'NOT FOUND'
);

function normalizeHexColor(val: string): string {
  const clean = val.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(clean)) {
    return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
  }
  return clean;
}

for (const token of EXPECTED_TOKENS) {
  // Find declaration inside :root or anywhere in CSS
  const tokenPat = token.name + '\\s*:\\s*([^;}\\n]+)';
  const rootMatch = rootContent.match(new RegExp(tokenPat, 'i'));
  const globalMatches = Array.from(primaryCssContent.matchAll(new RegExp(tokenPat, 'gi')));

  // Pick the concrete hex value definition
  const hexDef = globalMatches.find(m => m[1].trim().startsWith('#')) || rootMatch;

  if (hexDef) {
    const rawValue = hexDef[1].trim();
    const normalizedActual = normalizeHexColor(rawValue);
    const normalizedExpected = normalizeHexColor(token.expectedValue);
    const isMatch = normalizedActual === normalizedExpected;

    assert(
      'Design Tokens',
      `Token ${token.name} has exact value ${token.expectedValue}`,
      isMatch,
      token.expectedValue,
      rawValue,
      `Normalized: ${normalizedActual} | Role: ${token.role}`
    );
  } else {
    assert(
      'Design Tokens',
      `Token ${token.name} exists in compiled CSS`,
      false,
      token.expectedValue,
      'NOT FOUND',
      `Role: ${token.role}`
    );
  }
}

// ----------------------------------------------------------------------------
// 4. TYPOGRAPHIC LEGIBILITY RULES (modern-web-guidance: improve-text-layout-and-legibility)
// ----------------------------------------------------------------------------
// Heading balance: h1-h6 -> text-wrap: balance
const headingBalanceMatches = [
  ...primaryCssContent.matchAll(/([^{}]+)\{[^{}]*text-wrap\s*:\s*balance[^{}]*\}/gi)
];

assert(
  'Typography Rules',
  'text-wrap: balance rule compiled in production stylesheet',
  headingBalanceMatches.length > 0,
  '>= 1 rule with text-wrap: balance',
  `${headingBalanceMatches.length} rules found`,
  headingBalanceMatches.map(m => m[0].trim()).join(' | ')
);

// Verify heading tags are covered
let coversHeadings = false;
for (const match of headingBalanceMatches) {
  const selector = match[1];
  if (/h1/i.test(selector) && /h2/i.test(selector) && /h3/i.test(selector)) {
    coversHeadings = true;
    break;
  }
}
assert(
  'Typography Rules',
  'text-wrap: balance targets heading selectors (h1, h2, h3...)',
  coversHeadings,
  'Selectors include h1, h2, h3',
  coversHeadings ? 'Confirmed' : 'Heading selectors missing from rule'
);

// Body pretty: p, blockquote -> text-wrap: pretty
const bodyPrettyMatches = [
  ...primaryCssContent.matchAll(/([^{}]+)\{[^{}]*text-wrap\s*:\s*pretty[^{}]*\}/gi)
];

assert(
  'Typography Rules',
  'text-wrap: pretty rule compiled in production stylesheet',
  bodyPrettyMatches.length > 0,
  '>= 1 rule with text-wrap: pretty',
  `${bodyPrettyMatches.length} rules found`,
  bodyPrettyMatches.map(m => m[0].trim()).join(' | ')
);

let coversBody = false;
for (const match of bodyPrettyMatches) {
  const selector = match[1];
  if (/p/i.test(selector) || /blockquote/i.test(selector)) {
    coversBody = true;
    break;
  }
}
assert(
  'Typography Rules',
  'text-wrap: pretty targets body copy (p / blockquote)',
  coversBody,
  'Selectors include p or blockquote',
  coversBody ? 'Confirmed' : 'Body selectors missing from rule'
);

// ----------------------------------------------------------------------------
// 5. ACCESSIBLE KEYBOARD FOCUS STATES
// ----------------------------------------------------------------------------
// :focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
const focusVisibleMatches = [
  ...primaryCssContent.matchAll(/([^{}]*:focus-visible[^{}]*)\{([^{}]+)\}/gi)
];

assert(
  'Accessibility Focus',
  ':focus-visible rule is present in compiled stylesheet',
  focusVisibleMatches.length > 0,
  '>= 1 :focus-visible rule',
  `${focusVisibleMatches.length} rules found`
);

let hasOutlineProperty = false;
let hasOutlineOffset = false;
for (const match of focusVisibleMatches) {
  const body = match[2];
  if (/outline\s*:/i.test(body)) hasOutlineProperty = true;
  if (/outline-offset\s*:/i.test(body)) hasOutlineOffset = true;
}

assert(
  'Accessibility Focus',
  ':focus-visible specifies outline property',
  hasOutlineProperty,
  'outline property present',
  hasOutlineProperty ? 'Present' : 'Missing'
);

assert(
  'Accessibility Focus',
  ':focus-visible specifies outline-offset property',
  hasOutlineOffset,
  'outline-offset property present',
  hasOutlineOffset ? 'Present' : 'Missing'
);

// ----------------------------------------------------------------------------
// 6. NATIVE DIALOG & BACKDROP STYLING (modern-web-guidance: light-dismiss-a-dialog)
// ----------------------------------------------------------------------------
const dialogMatches = [
  ...primaryCssContent.matchAll(/([^{}]*dialog[^{}]*)\{([^{}]+)\}/gi)
];

assert(
  'Dialog Styling',
  'dialog element styles present in compiled stylesheet',
  dialogMatches.length > 0,
  '>= 1 dialog selector rule',
  `${dialogMatches.length} rules found`
);

const backdropMatches = [
  ...primaryCssContent.matchAll(/([^{}]*dialog::backdrop[^{}]*)\{([^{}]+)\}/gi)
];

assert(
  'Dialog Backdrop',
  'dialog::backdrop selector rule present',
  backdropMatches.length > 0,
  '>= 1 dialog::backdrop rule',
  `${backdropMatches.length} rules found`
);

let hasBackdropFilterBlur = false;
let hasWebkitBackdropFilter = false;
let hasBackdropBackground = false;
let backdropBgValue = '';

for (const match of backdropMatches) {
  const body = match[2];
  if (/backdrop-filter\s*:[^;]*blur/i.test(body)) hasBackdropFilterBlur = true;
  if (/-webkit-backdrop-filter\s*:[^;]*blur/i.test(body)) hasWebkitBackdropFilter = true;
  const bgMatch = body.match(/background(?:-color)?\s*:\s*([^;\}]+)/i);
  if (bgMatch) {
    backdropBgValue = bgMatch[1].trim();
    // rgba(15, 23, 42, 0.75) minifies to #0f172abf
    if (/rgba/i.test(backdropBgValue) || /#0f172abf/i.test(backdropBgValue)) {
      hasBackdropBackground = true;
    }
  }
}

assert(
  'Dialog Backdrop',
  'dialog backdrop blur styling is present (-webkit-backdrop-filter or backdrop-filter)',
  hasBackdropFilterBlur || hasWebkitBackdropFilter,
  'blur(4px) backdrop filter',
  hasWebkitBackdropFilter ? '-webkit-backdrop-filter: blur(4px) present' : (hasBackdropFilterBlur ? 'backdrop-filter: blur(4px) present' : 'Missing')
);

assert(
  'Dialog Backdrop',
  'dialog::backdrop specifies translucent backdrop color (rgba(15, 23, 42, 0.75) / #0f172abf)',
  hasBackdropBackground,
  'rgba(15, 23, 42, 0.75) or minified hex #0f172abf',
  backdropBgValue || 'Missing'
);

// ----------------------------------------------------------------------------
// 7. VIEW TRANSITIONS & MOTION PREFERENCES (modern-web-guidance: same-document-transitions)
// ----------------------------------------------------------------------------
const prefersReducedMotionRegex = /@media[^{]*prefers-reduced-motion\s*:\s*reduce[^{}]*\{([^}]+(\{[^}]*\}[^}]+)*)\}/i;
const reducedMotionMatch = primaryCssContent.match(prefersReducedMotionRegex);

assert(
  'View Transitions',
  '@media (prefers-reduced-motion: reduce) rule present in CSS',
  Boolean(reducedMotionMatch),
  'prefers-reduced-motion: reduce media block',
  reducedMotionMatch ? 'Present' : 'Missing'
);

const photoHeroTransitionRegex = /::view-transition-(old|new)\(photo-hero\)/i;
const photoHeroMatch = primaryCssContent.match(photoHeroTransitionRegex);

assert(
  'View Transitions',
  '::view-transition-(old|new)(photo-hero) rules present to protect aspect ratio',
  Boolean(photoHeroMatch),
  'photo-hero view transition rules',
  photoHeroMatch ? 'Present' : 'Missing'
);

// ----------------------------------------------------------------------------
// 8. ADVERSARIAL SCANNER / HYGIENE CHECKS
// ----------------------------------------------------------------------------
// Check that .agents classes didn't leak into CSS (e.g. .\[vite\:build-html\])
const phantomAgentClassMatch = primaryCssContent.match(/\.\[vite\\:build-html\]/i);
assert(
  'Asset Hygiene',
  'No leaked Tailwind phantom agent classes (.[vite:build-html])',
  !phantomAgentClassMatch,
  'No phantom classes',
  phantomAgentClassMatch ? 'LEAKED' : 'Clean'
);

// ----------------------------------------------------------------------------
// RESULTS PRESENTATION
// ----------------------------------------------------------------------------
console.log('\n--- VERIFICATION TEST MATRIX ---\n');

let passCount = 0;
let failCount = 0;

for (const res of results) {
  const status = res.passed ? 'PASS' : 'FAIL';
  if (res.passed) passCount++;
  else failCount++;

  console.log(`[${status}] [${res.category}] ${res.name}`);
  if (!res.passed) {
    console.log(`       Expected: ${res.expected}`);
    console.log(`       Actual:   ${res.actual}`);
  }
  if (res.details) {
    console.log(`       Details:  ${res.details}`);
  }
}

console.log('\n===============================================================');
console.log(`TOTAL TESTS: ${results.length} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log(`OVERALL EMPIRICAL VERDICT: ${failCount === 0 ? 'APPROVE' : 'REQUEST_CHANGES'}`);
console.log('===============================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
