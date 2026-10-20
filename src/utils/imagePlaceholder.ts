/**
 * src/utils/imagePlaceholder.ts
 *
 * Generates clean, gallery-grade SVG placeholder data URLs when operating offline
 * so images always display crisp visual geometry and title metadata.
 */

export function createSvgPlaceholder(
  title: string,
  collection = 'gallery',
  width = 1200,
  height = 800
): string {
  const safeTitle = title.replace(/[<>&"']/g, '');
  const safeCollection = collection.toUpperCase().replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#F8FAFC"/>
    <rect x="32" y="32" width="${width - 64}" height="${height - 64}" fill="none" stroke="#E2E8F0" stroke-width="2"/>
    <line x1="32" y1="${height * 0.65}" x2="${width - 32}" y2="${height * 0.65}" stroke="#E2E8F0" stroke-width="1"/>
    <circle cx="${width * 0.75}" cy="${height * 0.35}" r="${Math.min(width, height) * 0.12}" fill="#EFF6FF" stroke="#BFDBFE" stroke-width="2"/>
    <text x="72" y="${height - 110}" font-family="Inter, sans-serif" font-size="18" font-weight="600" fill="#64748B" letter-spacing="2">${safeCollection}</text>
    <text x="72" y="${height - 72}" font-family="Inter, sans-serif" font-size="28" font-weight="700" fill="#0F172A">${safeTitle}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
