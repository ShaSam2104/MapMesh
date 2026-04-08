import { useState } from 'react';
import { Download, Copy } from 'lucide-react';
import { useStore } from '@/state/store';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { exportSTL } from '@/lib/exporters/exportSTL';
import { export3MF } from '@/lib/exporters/export3MF';
import { download, exportFilename } from '@/lib/exporters/download';
import { buildExportGeometry } from '@/lib/exporters/buildExportGeometry';
import { dumpLogsAsText } from '@/lib/log/browser';
import { tagged } from '@/lib/log/logger';

const log = tagged('export-ui');

export function ExportPanel(): JSX.Element {
  const [format, setFormat] = useState<'stl' | '3mf'>('stl');
  const dims = useStore((s) => s.mesh.dimsMm);
  const triCount = useStore((s) => s.mesh.triCount);
  const plinthGeometry = useStore((s) => s.mesh.plinthGeometry);
  const status = useStore((s) => s.mesh.status);
  const selection = useStore((s) => s.selection);

  const ready = status === 'ready' && plinthGeometry != null;

  const doExport = async () => {
    // Pull the live mesh + layers slice at click time so the export reflects
    // any layer toggles the user made after Generate.
    const { mesh, layers } = useStore.getState();
    const merged = buildExportGeometry({ mesh, layers });
    if (!merged) {
      log.warn('export aborted: no merged geometry');
      return;
    }
    try {
      const filename = exportFilename(
        selection.center,
        selection.shape,
        selection.sizeKm,
        format,
      );
      const blob =
        format === 'stl' ? exportSTL(merged) : await export3MF(merged);
      download({ blob, filename });
      log.info('exported', { format, filename, bytes: blob.size });
    } catch (err) {
      log.error('export failed', err);
    } finally {
      merged.dispose();
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
        <Download size={14} /> Download {format.toUpperCase()}
      </Button>

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
