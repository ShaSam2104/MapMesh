export function EmptyState(): JSX.Element {
  return (
    <div className="surface px-6 py-5 text-center">
      <div className="label">Nothing generated yet</div>
      <p className="mt-2 font-display text-xl tracking-tight">
        Pick an area, press Generate.
      </p>
      <p className="text-xs text-ink-1 mt-1">Watertight plinth + terrain + buildings.</p>
    </div>
  );
}
