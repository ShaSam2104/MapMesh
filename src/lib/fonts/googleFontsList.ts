/**
 * Static snapshot of the full Google Fonts family catalogue.
 *
 * Source: `https://fonts.google.com/metadata/fonts` — the same endpoint
 * that powers the public fonts.google.com directory. The metadata
 * endpoint does not send CORS headers, so we can't fetch it at runtime
 * from the browser; instead we ship a stripped JSON snapshot at
 * `googleFontsListFull.json` containing `{ family, variants, category }`
 * for each of the ~1929 families.
 *
 * To refresh the snapshot after upstream changes:
 *
 *   1. `curl https://fonts.google.com/metadata/fonts -o /tmp/gfonts.json`
 *   2. Run the snapshot builder (see `docs/FONTS.md`) which strips the
 *      payload down to `{ family, variants, category }` and writes
 *      `src/lib/fonts/googleFontsListFull.json`.
 *   3. Bump `GOOGLE_FONTS_REVISION`.
 *
 * The picker supports a free-text fallback, so even if a brand-new
 * Google Fonts family lands upstream before we refresh the snapshot,
 * the user can still type its exact name and the CSS2 fetch in
 * `googleFonts.browser.ts` will pull the webfont.
 *
 * @module lib/fonts/googleFontsList
 */

import snapshot from './googleFontsListFull.json';

export interface GoogleFontFamily {
  family: string;
  /** Supported variants. v1 only uses `"regular"` + `"700"`. */
  variants: readonly string[];
  /** Rough categorisation for grouping in the picker. */
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
}

interface Snapshot {
  revision: string;
  families: Array<{
    family: string;
    variants: string[];
    category: string;
  }>;
}

const typedSnapshot = snapshot as Snapshot;

export const GOOGLE_FONTS_REVISION: string = typedSnapshot.revision;

export const GOOGLE_FONTS_LIST: readonly GoogleFontFamily[] =
  typedSnapshot.families.map((f) => ({
    family: f.family,
    variants: f.variants,
    category: normalizeCategory(f.category),
  }));

function normalizeCategory(c: string): GoogleFontFamily['category'] {
  switch (c) {
    case 'serif':
      return 'serif';
    case 'display':
      return 'display';
    case 'handwriting':
      return 'handwriting';
    case 'monospace':
      return 'monospace';
    case 'sans-serif':
    default:
      return 'sans-serif';
  }
}

/**
 * Returns families filtered by a case-insensitive substring match on
 * the family name. Empty query returns the whole list.
 */
export function searchGoogleFonts(query: string): GoogleFontFamily[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...GOOGLE_FONTS_LIST];
  return GOOGLE_FONTS_LIST.filter((f) => f.family.toLowerCase().includes(q));
}
