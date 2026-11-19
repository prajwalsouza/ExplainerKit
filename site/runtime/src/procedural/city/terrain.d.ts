// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function cityTerrain(spec: any): Readonly<{
    source?: Readonly<{
        name: any;
        url: any;
        attribution: any;
    }> | undefined;
    columns: any;
    rows: any;
    bounds: Readonly<{
        x0: any;
        y0: any;
        x1: any;
        y1: any;
    }>;
    values: Float32Array<ArrayBuffer>;
    min: number;
    max: number;
}> | null;
export function terrainHeight(terrain: any, x: any, z: any): any;
export function cityGroundHeight(city: any, x: any, z: any): any;
export function citySurfaceHeight(city: any, x: any, z: any, roadId: any, altitude: any): any;
