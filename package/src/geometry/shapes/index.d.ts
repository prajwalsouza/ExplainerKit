// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function polygonArea(points: any): number;
export function polygon(points: any): Readonly<{
    polygons: any;
    commands: any;
    area: any;
    diagnostics: Readonly<{
        method: "convexHalfPlanes";
        partitionSeams: boolean;
    }>;
}>;
export function asShape(value: any): any;
export function intersect(left: any, right: any): Readonly<{
    polygons: any;
    commands: any;
    area: any;
    diagnostics: Readonly<{
        method: "convexHalfPlanes";
        partitionSeams: boolean;
    }>;
}>;
export function subtract(left: any, right: any): Readonly<{
    polygons: any;
    commands: any;
    area: any;
    diagnostics: Readonly<{
        method: "convexHalfPlanes";
        partitionSeams: boolean;
    }>;
}>;
export function union(left: any, right: any): Readonly<{
    polygons: any;
    commands: any;
    area: any;
    diagnostics: Readonly<{
        method: "convexHalfPlanes";
        partitionSeams: boolean;
    }>;
}>;
export function centroid(value: any): Readonly<{
    x: number;
    y: number;
}>;
/** Seeded Voronoi cells clipped against actual source geometry, not duplicates. */
export function fracture(input: any, spec?: {}): Readonly<{
    pieces: readonly Readonly<{
        id: `piece-${number}`;
        shape: Readonly<{
            polygons: any;
            commands: any;
            area: any;
            diagnostics: Readonly<{
                method: "convexHalfPlanes";
                partitionSeams: boolean;
            }>;
        }>;
        commands: any;
        polygons: any;
        area: any;
        site: Readonly<{
            x: any;
            y: any;
        }>;
    }>[];
    source: any;
    seed: any;
    area: any;
    diagnostics: Readonly<{
        method: "clippedVoronoi";
        partition: true;
        exactArithmetic: false;
    }>;
}>;
export { booleanPath, unionPaths, intersectPaths, subtractPaths, pathLoops } from "./boolean.js";
