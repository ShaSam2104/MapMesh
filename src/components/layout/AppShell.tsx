import { useState } from 'react';
import { Header } from './Header';
import { NavRail } from './NavRail';
import { SplitPane } from './SplitPane';
import { InspectorDrawer } from './InspectorDrawer';
import { MapView } from '@/components/map/MapView';
import { SceneCanvas } from '@/components/scene/SceneCanvas';
import { ShapeTab } from '@/components/controls/ShapeTab';
import { LayerAccordion } from '@/components/controls/LayerAccordion';
import { PathTab } from '@/components/controls/PathTab';
import { TextTab } from '@/components/controls/TextTab';
import { ExportPanel } from '@/components/controls/ExportPanel';

type Tab = 'shape' | 'style' | 'path' | 'text' | 'export';

const TAB_LABEL: Record<Tab, string> = {
  shape: 'Shape',
  style: 'Style',
  path: 'Path',
  text: 'Text',
  export: 'Export',
};

export function AppShell(): JSX.Element {
  const [tab, setTab] = useState<Tab>('shape');
  const [drawerOpen, setDrawerOpen] = useState(true);

  return (
    <div className="h-full flex flex-col bg-bg-0">
      <Header />
      <div className="flex-1 flex overflow-hidden relative">
        <NavRail
          activeTab={tab}
          onSelect={(t) => {
            setTab(t);
            setDrawerOpen(true);
          }}
        />
        <SplitPane left={<MapView />} right={<SceneCanvas />} />
        <InspectorDrawer
          open={drawerOpen}
          title={TAB_LABEL[tab]}
          onClose={() => setDrawerOpen(false)}
        >
          {tab === 'shape' && <ShapeTab />}
          {tab === 'style' && <LayerAccordion />}
          {tab === 'path' && <PathTab />}
          {tab === 'text' && <TextTab />}
          {tab === 'export' && <ExportPanel />}
        </InspectorDrawer>
      </div>
    </div>
  );
}
