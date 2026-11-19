// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** @param {{infer?: boolean, footprints?: any[], rails?: any[], blend?: number, lowerRailAt?: (x: number, y: number) => boolean}} [spec] */
export function buildWaterBridges(roads: any, field: any, waterIds: any, waterLevels: any, ground: any, budget: any, bounds: any, spec?: {
    infer?: boolean;
    footprints?: any[];
    rails?: any[];
    blend?: number;
    lowerRailAt?: (x: number, y: number) => boolean;
}): {
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
    profiles: WaterBridgeProfile[];
    roadIds: any[];
    approachIds: any[];
};
/**
 * @param {readonly WaterBridgeProfile[] | null | undefined} profiles
 * @param {number} x
 * @param {number} z
 * @param {number | string} [roadId]
 */
export function bridgeSurfaceHeight(profiles: readonly WaterBridgeProfile[] | null | undefined, x: number, z: number, roadId?: number | string): any;
export type BridgeVertex = [number, number, number];
export type WaterBridgeProfile = {
    roadId: number | string;
    roadIds?: (number | string)[];
    explicit: boolean;
    quad: [BridgeVertex, BridgeVertex, BridgeVertex, BridgeVertex];
    approach?: true;
} | {
    footprintId: number | string;
    roadIds: (number | string)[];
    explicit: true;
    quad: [BridgeVertex, BridgeVertex, BridgeVertex];
    approach?: true;
};
