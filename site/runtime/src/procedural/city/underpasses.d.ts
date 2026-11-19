// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Build short passages where a lower way actually crosses from one edge of a bridge to another. */
export function buildUnderpasses(roads: any, bridges: any, field: any, ground: any, budget: any, inferLights?: boolean): {
    roadIds: any[];
    profiles: {
        roadId: any;
        explicit: boolean;
        quad: any[];
        clearance: any;
    }[];
    mesh: {
        positions: Float32Array<ArrayBuffer>;
        normals: Float32Array<ArrayBuffer>;
        colors: Float32Array<ArrayBuffer>;
        extra: Float32Array<ArrayBuffer>;
        extraStride: number;
        indices: Uint32Array<ArrayBuffer>;
        vertexCount: number;
        triangleCount: number;
    };
    mask: {
        x0: number;
        z0: number;
        cell: number;
        width: number;
        height: number;
        values: Float32Array<ArrayBuffer>;
    };
    lights: {
        x: any;
        y: number;
        z: number;
        kind: string;
        mapped: boolean;
    }[];
} | null;
export function underpassSurfaceHeight(profiles: any, x: any, z: any, roadId: any): any;
