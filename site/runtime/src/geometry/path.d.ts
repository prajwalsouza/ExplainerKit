// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Prepared polyline approximation for distance, tangent, trim and path-follow rigs. */
export function measurePath(commands: any, spec?: {}): Readonly<{
    length: number | undefined;
    closed: any;
    points: readonly any[];
    at(fraction: any): Readonly<{
        x: any;
        y: any;
        rotation: number;
    }>;
    trim(start?: number, end?: number): readonly (readonly any[])[];
}>;
/** Distribute whole objects along a prepared contour; do not silently deform them. */
export function pathPlacements(commands: any, spec?: {}): readonly Readonly<{
    index: number;
    x: number;
    y: any;
    rotation: number;
}>[];
