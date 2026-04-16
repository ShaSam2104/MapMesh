import { Plus } from 'lucide-react';
import { useStore } from '@/state/store';
import { Button } from '@/components/ui/Button';
import { TextLabelRow } from './TextLabelRow';

/**
 * Inspector panel for managing raised-text labels on plinth flanges.
 *
 * Labels are rebuild inputs — any change debounces into `useAutoRebuild`
 * which re-runs the geometry pipeline against the cached raw data.
 */
export function TextTab(): JSX.Element {
  const labels = useStore((s) => s.textLabels);
  const addLabel = useStore((s) => s.addTextLabel);

  return (
    <div className="space-y-4">
      <p className="text-xs text-ink-1">
        Add engraved text labels to the sides of the plinth. Each label
        extends the base with a watertight flange and sits raised above
        its outer face. Colours export as separate parts in 3MF.
      </p>
      <Button
        variant="primary"
        onClick={() => addLabel()}
        aria-label="Add text label"
        className="w-full justify-center"
      >
        <Plus size={14} /> Add label
      </Button>
      {labels.length === 0 ? (
        <p className="text-xs text-ink-1">No labels yet.</p>
      ) : (
        <div className="space-y-2">
          {labels.map((l) => (
            <TextLabelRow key={l.id} labelId={l.id} />
          ))}
        </div>
      )}
    </div>
  );
}
