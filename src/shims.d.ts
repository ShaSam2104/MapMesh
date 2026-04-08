/**
 * Ambient module shims for third-party packages that lack their own type
 * definitions. Prefer fixing upstream or pinning exact runtime APIs here
 * rather than sprinkling `any` through the codebase.
 */

declare module '@jscadui/3mf-export' {
  /** A mesh entry used by `to3dmodel`. `vertices` is flat xyz, `indices` is flat triangles. */
  export interface SimpleMesh {
    id: string;
    vertices: number[];
    indices: number[];
    /** 3×4 row-major transform, 12 numbers. */
    transforms?: number[];
  }

  /** Options accepted by `to3dmodel`. */
  export interface To3dmodelOptions {
    simple?: SimpleMesh[];
    meshes?: SimpleMesh[];
    components?: unknown[];
    unit?: 'millimeter' | 'inch' | 'foot' | 'meter' | 'micron';
    title?: string;
    author?: string;
    description?: string;
    application?: string;
    creationDate?: Date;
    license?: string;
    modificationDate?: Date;
  }

  /** Emits the `3D/3dmodel.model` XML as a string. */
  export function to3dmodel(options: To3dmodelOptions): string;

  /** Static ZIP entry: `[Content_Types].xml`. */
  export const fileForContentTypes: { name: string; content: string };
  /** Static ZIP entry: `_rels/.rels`. */
  export const fileForRelThumbnail: { name: string; content: string };
}
