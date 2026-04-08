import { useCallback, useEffect, useRef, useState } from 'react';
import { useSplit } from '@/hooks/useSplit';

export interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

export function SplitPane({ left, right }: SplitPaneProps): JSX.Element {
  const [ratio, setRatio] = useSplit();
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const onMouseDown = useCallback(() => setDragging(true), []);
  const onMouseUp = useCallback(() => setDragging(false), []);
  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setRatio((e.clientX - rect.left) / rect.width);
    },
    [dragging, setRatio],
  );

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging, onMouseMove, onMouseUp]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 flex overflow-hidden"
      aria-label="Map and 3D split"
    >
      <div style={{ width: `${ratio * 100}%` }} className="h-full overflow-hidden">
        {left}
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize split"
        tabIndex={0}
        onMouseDown={onMouseDown}
        className="w-px bg-line-hot hover:bg-accent cursor-col-resize"
      />
      <div style={{ width: `${(1 - ratio) * 100}%` }} className="h-full overflow-hidden">
        {right}
      </div>
    </div>
  );
}
