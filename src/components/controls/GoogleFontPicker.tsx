import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  GOOGLE_FONTS_LIST,
  searchGoogleFonts,
  type GoogleFontFamily,
} from '@/lib/fonts/googleFontsList';

/** Cap the dropdown so we never render the full 1900-entry list at once. */
const DROPDOWN_CAP = 100;

export interface GoogleFontPickerProps {
  /** Accessible label — shown above the input. */
  label: string;
  /** Current Google Fonts family name, e.g. `"Roboto"`. */
  value: string;
  onChange: (family: string) => void;
}

/**
 * Searchable Google Fonts family picker.
 *
 * Backed by the full Google Fonts catalogue shipped at
 * `src/lib/fonts/googleFontsListFull.json` (~1929 families). The
 * dropdown caps at {@link DROPDOWN_CAP} rendered entries to keep the
 * DOM cheap — users narrow down via the search box to find families
 * beyond the first page.
 *
 * If the typed query doesn't exactly match a known family, a free-text
 * fallback option "Use '{query}'" is shown at the top. Picking it sets
 * the family to the typed string as-is — the CSS2 fetch in
 * `googleFonts.browser.ts` will then try to pull the webfont, so any
 * valid Google Fonts family (including ones added upstream after the
 * snapshot was taken) works.
 */
export function GoogleFontPicker({
  label,
  value,
  onChange,
}: GoogleFontPickerProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const trimmed = query.trim();
  const results = useMemo<GoogleFontFamily[]>(() => {
    const all = trimmed ? searchGoogleFonts(trimmed) : [...GOOGLE_FONTS_LIST];
    return all.slice(0, DROPDOWN_CAP);
  }, [trimmed]);

  // Offer a "Use '{query}' anyway" entry whenever the user has typed
  // something that does not exactly match a known family. This covers
  // the two legitimate cases where the snapshot is stale:
  //   1. Brand-new Google Fonts family added after our snapshot date.
  //   2. A family that was dropped from the list but still resolvable
  //      via the CSS2 endpoint.
  const hasExactMatch = results.some(
    (f) => f.family.toLowerCase() === trimmed.toLowerCase(),
  );
  const showFreeText = trimmed.length > 0 && !hasExactMatch;

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pick = (family: string) => {
    onChange(family);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative space-y-1">
      <div className="label">{label}</div>
      <button
        type="button"
        aria-label={`${label}: ${value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="focus-ring w-full flex items-center justify-between border border-line rounded-sm px-2 py-2 text-left text-sm bg-bg-1 hover:bg-bg-2"
      >
        <span className="truncate">{value}</span>
        <ChevronDown size={14} strokeWidth={1.5} className="text-ink-1" />
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 w-full surface p-2 max-h-64 overflow-hidden flex flex-col"
          role="dialog"
          aria-label={`${label} picker`}
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="Search fonts..."
            aria-label="Search Google Fonts"
            className="focus-ring border border-line rounded-sm px-2 py-1 text-xs bg-bg-0 mb-2"
            autoFocus
          />
          <ul
            role="listbox"
            aria-label={label}
            className="overflow-y-auto flex-1"
          >
            {showFreeText && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => pick(trimmed)}
                  className="focus-ring w-full text-left text-xs px-2 py-1.5 rounded-sm flex items-center justify-between gap-2 text-ink-0 hover:bg-bg-2 border-b border-line"
                >
                  <span className="truncate">Use &ldquo;{trimmed}&rdquo;</span>
                  <span className="text-[10px] uppercase tracking-label text-accent">
                    custom
                  </span>
                </button>
              </li>
            )}
            {results.length === 0 && !showFreeText && (
              <li className="text-xs text-ink-1 px-2 py-1">No matches</li>
            )}
            {results.map((f) => {
              const active = f.family === value;
              return (
                <li key={f.family}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => pick(f.family)}
                    className={
                      'focus-ring w-full text-left text-xs px-2 py-1.5 rounded-sm flex items-center justify-between gap-2 ' +
                      (active
                        ? 'bg-bg-2 text-ink-0'
                        : 'text-ink-0 hover:bg-bg-2')
                    }
                  >
                    <span className="truncate">{f.family}</span>
                    <span className="text-[10px] uppercase tracking-label text-ink-1">
                      {f.category}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
