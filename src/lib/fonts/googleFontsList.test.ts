import { describe, expect, it } from 'vitest';
import { GOOGLE_FONTS_LIST, searchGoogleFonts } from './googleFontsList';

describe('googleFontsList', () => {
  it('ships the full catalog with unique family names', () => {
    // Snapshot of the full Google Fonts metadata endpoint. We guard on
    // the lower bound (not an exact count) so the test survives the
    // occasional upstream family drop between snapshot refreshes.
    expect(GOOGLE_FONTS_LIST.length).toBeGreaterThan(1500);
    const names = new Set(GOOGLE_FONTS_LIST.map((f) => f.family));
    expect(names.size).toBe(GOOGLE_FONTS_LIST.length);
  });

  it('includes display families from the full catalog', () => {
    // Regression guard: the very first release only shipped ~60
    // curated families, which missed common display fonts like
    // "Racing Sans One" the user explicitly asked for.
    const hasRacing = GOOGLE_FONTS_LIST.some(
      (f) => f.family === 'Racing Sans One',
    );
    expect(hasRacing).toBe(true);
  });

  it('every family has a "regular" variant (v1 constraint)', () => {
    for (const f of GOOGLE_FONTS_LIST) {
      expect(f.variants).toContain('regular');
    }
  });

  it('searchGoogleFonts returns all families for empty query', () => {
    expect(searchGoogleFonts('').length).toBe(GOOGLE_FONTS_LIST.length);
  });

  it('searchGoogleFonts filters by case-insensitive substring', () => {
    const results = searchGoogleFonts('ROBO');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.family.toLowerCase()).toContain('robo');
    }
  });

  it('searchGoogleFonts returns empty for an unknown query', () => {
    expect(searchGoogleFonts('notarealfontxyz123')).toEqual([]);
  });
});
