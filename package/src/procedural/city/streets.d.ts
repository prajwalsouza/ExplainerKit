// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A bridge deck is shaded only by the ways that use it and the ways that join its ends. */
export function bridgeStreetField(osm: any, bounds: any, cell: any, deckIds: any, underpassIds: any, approachIds?: any[]): {
    width: number;
    height: number;
    cell: any;
    x0: any;
    y0: any;
    edge: Float32Array<ArrayBuffer>;
    centre: Float32Array<ArrayBuffer>;
    along: Float32Array<ArrayBuffer>;
    half: Float32Array<ArrayBuffer>;
    lanes: Float32Array<ArrayBuffer>;
    junction: Float32Array<ArrayBuffer>;
    zebra: Float32Array<ArrayBuffer>;
    foot: Float32Array<ArrayBuffer>;
    footKind: Float32Array<ArrayBuffer>;
    water: Float32Array<ArrayBuffer>;
    green: Float32Array<ArrayBuffer>;
    greenKind: Float32Array<ArrayBuffer>;
    wall: Float32Array<ArrayBuffer>;
    bridge: Float32Array<ArrayBuffer>;
    lamp: Float32Array<ArrayBuffer>;
    roof: Float32Array<ArrayBuffer>;
};
/**
 * Bake the street field for parsed map features. `bounds` is {x0, y0, x1, y1} in metres and
 * `cell` the size of a grid cell. Work is bounded by the cell count and by the band around
 * each feature, never by the whole grid per feature.
 */
export function streetField(osm: any, bounds: any, cell: any, separateWater?: boolean): {
    field: {
        width: number;
        height: number;
        cell: any;
        x0: any;
        y0: any;
        edge: Float32Array<ArrayBuffer>;
        centre: Float32Array<ArrayBuffer>;
        along: Float32Array<ArrayBuffer>;
        half: Float32Array<ArrayBuffer>;
        lanes: Float32Array<ArrayBuffer>;
        junction: Float32Array<ArrayBuffer>;
        zebra: Float32Array<ArrayBuffer>;
        foot: Float32Array<ArrayBuffer>;
        footKind: Float32Array<ArrayBuffer>;
        water: Float32Array<ArrayBuffer>;
        green: Float32Array<ArrayBuffer>;
        greenKind: Float32Array<ArrayBuffer>;
        wall: Float32Array<ArrayBuffer>;
        bridge: Float32Array<ArrayBuffer>;
        lamp: Float32Array<ArrayBuffer>;
        roof: Float32Array<ArrayBuffer>;
    };
    waterIds: Uint32Array<ArrayBuffer> | null;
    junctions: {
        x: any;
        y: any;
        arms: any;
        width: any;
    }[];
    crossings: {
        x: any;
        y: any;
        kind: any;
        road: number;
        half: number;
    }[];
    cars: any[];
    sample: (name: any, x: any, y: any) => any;
    clearOfTransport: (x: any, y: any) => boolean;
    lowerRailAt: (x: any, y: any) => boolean;
    scatterLeaves: (x: any, y: any, radius: any) => void;
    light: (x: any, y: any, radius?: number, strength?: number) => void;
};
/** Points every `step` metres along a road, with the direction of travel at each. */
export function alongRoad(points: any, step: any, start?: number): {
    x: any;
    y: any;
    dx: number;
    dy: number;
}[];
export const MAX_FIELD_CELLS: number;
/** Codes for surfaces people walk or cycle on. */
export const footKinds: Readonly<{
    footway: 1;
    path: 1;
    cycleway: 2;
    pedestrian: 3;
    steps: 4;
    track: 5;
}>;
export const greenKinds: Readonly<{
    grass: 1;
    park: 2;
    wood: 3;
}>;
