import {
  Map as MapIcon,
  Box,
  Palette,
  Download,
  Type,
  type LucideIcon,
} from 'lucide-react';

export interface NavRailProps {
  activeTab: 'shape' | 'style' | 'path' | 'text' | 'export';
  onSelect: (tab: 'shape' | 'style' | 'path' | 'text' | 'export') => void;
}

export function NavRail({ activeTab, onSelect }: NavRailProps): JSX.Element {
  const items: Array<{
    key: NavRailProps['activeTab'];
    label: string;
    Icon: LucideIcon;
  }> = [
    { key: 'shape', label: 'Shape', Icon: MapIcon },
    { key: 'style', label: 'Style', Icon: Palette },
    { key: 'path', label: 'Path', Icon: Box },
    { key: 'text', label: 'Text', Icon: Type },
    { key: 'export', label: 'Export', Icon: Download },
  ];

  return (
    <nav
      aria-label="Main navigation"
      className="w-[72px] border-r border-line bg-bg-0 flex flex-col items-center py-3 gap-1"
    >
      {items.map(({ key, label, Icon }) => {
        const isActive = activeTab === key;
        return (
          <button
            key={key}
            type="button"
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(key)}
            className={
              'focus-ring flex flex-col items-center justify-center w-14 h-14 rounded-sm gap-1 ' +
              (isActive
                ? 'bg-bg-2 text-ink-0 border border-line-hot'
                : 'text-ink-1 hover:bg-bg-2')
            }
          >
            <Icon size={18} strokeWidth={1.5} />
            <span className="text-[10px] uppercase tracking-label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
