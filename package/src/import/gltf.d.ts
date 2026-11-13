// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Static glTF2/GLB geometry. Edges by default; optional triangle indices. Never fetches. */
export function importGLTF(input: any, spec?: {}): Readonly<{
    geometry: Readonly<{
        triangles?: readonly any[] | undefined;
        vertices: readonly any[];
        edges: readonly any[];
    }>;
    nodes: readonly any[];
    diagnostics: Readonly<{
        format: string;
        scene: any;
        sourceNodes: number;
        primitives: number;
        triangles: number;
        vertices: number;
        edges: number;
        bufferBytes: number;
        lines: "edges";
        materials: "notImported";
        animations: false;
    }>;
}>;
