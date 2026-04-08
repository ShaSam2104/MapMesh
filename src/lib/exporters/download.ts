/**
 * Browser-only helper that triggers a file download via `<a download>`.
 *
 * This is one of the rare `*.browser.ts`-equivalent escape hatches in
 * `src/lib/`; it is only called from user-gesture handlers (the Export tab).
 *
 * @module lib/exporters/download
 */

export interface DownloadOptions {
  blob: Blob;
  filename: string;
}

/**
 * Programmatically downloads a blob with the given filename.
 */
export function download({ blob, filename }: DownloadOptions): void {
  if (typeof document === 'undefined') {
    throw new Error('download() can only be called in a browser context');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick so the browser has started the download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generates a deterministic export filename for a selection.
 */
export function exportFilename(
  center: [number, number],
  shape: string,
  sizeKm: number,
  ext: 'stl' | '3mf',
): string {
  const [lng, lat] = center;
  const f = (n: number) => n.toFixed(4);
  return `meshmap_${f(lat)}_${f(lng)}_${shape}_${sizeKm}km.${ext}`;
}
