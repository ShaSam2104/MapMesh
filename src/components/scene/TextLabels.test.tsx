import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TextLabels } from './TextLabels';
import { useStore } from '@/state/store';

describe('TextLabels', () => {
  it('renders nothing when there are no labels', async () => {
    // Reset
    for (const l of [...useStore.getState().textLabels]) {
      useStore.getState().removeTextLabel(l.id);
    }
    const r = await ReactThreeTestRenderer.create(<TextLabels />);
    expect(r.scene.children).toHaveLength(0);
  });

  it('renders one mesh per label that has geometry', async () => {
    for (const l of [...useStore.getState().textLabels]) {
      useStore.getState().removeTextLabel(l.id);
    }
    useStore.getState().addTextLabel('north');
    useStore.getState().addTextLabel('west');
    const [a, b] = useStore.getState().textLabels;
    useStore.getState().setMeshResult({
      textLabelGeometries: {
        [a.id]: new THREE.BoxGeometry(1, 1, 1),
        // b has no geometry — should render nothing
      },
    });
    const r = await ReactThreeTestRenderer.create(<TextLabels />);
    // One group > one mesh. `findAllByType` is synchronous despite
    // eslint-plugin-testing-library flagging it as an async query —
    // @react-three/test-renderer's API is intentionally non-promise.
    // eslint-disable-next-line testing-library/await-async-queries
    const meshes = r.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    // clean up
    useStore.getState().removeTextLabel(a.id);
    useStore.getState().removeTextLabel(b.id);
  });
});
