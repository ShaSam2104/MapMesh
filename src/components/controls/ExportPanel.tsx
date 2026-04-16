import { useState } from 'react';
import { Download, Copy, Loader2 } from 'lucide-react';
import { useStore } from '@/state/store';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { exportSTL } from '@/lib/exporters/exportSTL';
import { export3MF } from '@/lib/exporters/export3MF';
import { download, exportFilename } from '@/lib/exporters/download';
import { buildExportGeometry } from '@/lib/exporters/buildExportGeometry';
import { buildExportParts } from '@/lib/exporters/buildExportParts';
import { dumpLogsAsText } from '@/lib/log/browser';
import { tagged } from '@/lib/log/logger';
import { tick } from '@/lib/schedule';

const log = tagged('export-ui');

export function ExportPanel(): JSX.Element {
  const [format, setFormat] = useState<'stl' | '3mf'>('stl');
  const [busy, setBusy] = useState(false);
  const dims = useStore((s) => s.mesh.dimsMm);
  const triCount = useStore((s) => s.mesh.triCount);
  const plinthGeometry = useStore((s) => s.mesh.plinthGeometry);
  const status = useStore((s) => s.mesh.status);
  const selection = useStore((s) => s.selection);

  const ready = status === 'ready' && plinthGeometry != null && !busy;

  const doExport = async () => {
    // Pull the live mesh + layers slice at click time so the export reflects
    // any layer toggles the user made after Generate.
    const { mesh, layers, textLabels } = useStore.getState();
    setBusy(true);
    // Let React paint the "Exporting…" state + spinner BEFORE we drop
    // into the synchronous WASM work. Without this yield, React batches
    // the re-render with the heavy call that follows and the button
    // never visibly changes until the export finishes.
    await tick();
    try {
      const filename = exportFilename(
        selection.center,
        selection.shape,
        selection.sizeKm,
        format,
      );

      if (format === 'stl') {
        // STL: one monolithic watertight body. The STL format has no
        // standard colour support, so monochrome is the best we can do
        // — Bambu Studio, PrusaSlicer, and OrcaSlicer all ignore any
        // non-standard colour bytes. We still route through
        // manifold-3d so the exported mesh is guaranteed watertight.
        const merged = await buildExportGeometry({ mesh, layers });
        if (!merged) {
          log.warn('export aborted: no merged geometry');
          return;
        }
        try {
          const blob = exportSTL(merged);
          download({ blob, filename });
          log.info('exported', { format, filename, bytes: blob.size });
        } finally {
          merged.dispose();
        }
      } else {
        // 3MF: multi-object, per-layer colours via <basematerials>.
        // Every part is individually watertight (converted through
        // manifold-3d) so Bambu Studio sees a tree of clean coloured
        // bodies instead of one giant non-manifold blob.
        const parts = await buildExportParts({ mesh, layers, textLabels });
        if (parts.length === 0) {
          log.warn('export aborted: no parts');
          return;
        }
        try {
          const blob = await export3MF(parts);
          download({ blob, filename });
          log.info('exported', {
            format,
            filename,
            bytes: blob.size,
            parts: parts.length,
          });
        } finally {
          for (const p of parts) p.geometry.dispose();
        }
      }
    } catch (err) {
      log.error('export failed', err);
    } finally {
      setBusy(false);
    }
  };

  const copyDebug = async () => {
    try {
      await navigator.clipboard.writeText(dumpLogsAsText());
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-5">
      <Segmented<'stl' | '3mf'>
        label="Format"
        value={format}
        onChange={setFormat}
        options={[
          { value: 'stl', label: 'STL' },
          { value: '3mf', label: '3MF' },
        ]}
      />

      <div className="space-y-1">
        <div className="label">Dimensions</div>
        <div className="font-mono text-xs tabular-nums">
          {dims
            ? `${Math.round(dims.x)} × ${Math.round(dims.y)} × ${Math.round(dims.z)} mm`
            : '—'}
        </div>
      </div>

      <div className="space-y-1">
        <div className="label">Triangles</div>
        <div className="font-mono text-xs tabular-nums">
          {triCount?.toLocaleString() ?? '—'}
        </div>
      </div>

      <Button
        variant="primary"
        disabled={!ready}
        onClick={() => void doExport()}
        className="w-full justify-center"
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Download size={14} />
        )}{' '}
        {busy ? 'Exporting…' : `Download ${format.toUpperCase()}`}
      </Button>
      {format === 'stl' ? (
        <div className="text-[11px] leading-snug text-ink-2">
          STL is monochrome by format. Export 3MF to keep per-layer colours in Bambu Studio / PrusaSlicer.
        </div>
      ) : (
        <div className="text-[11px] leading-snug text-ink-2">
          3MF keeps each layer as its own coloured body in the slicer.
        </div>
      )}

      <button
        type="button"
        onClick={() => void copyDebug()}
        className="focus-ring text-xs text-ink-1 hover:text-ink-0 inline-flex items-center gap-1"
      >
        <Copy size={12} /> Copy debug info
      </button>
    </div>
  );
}
