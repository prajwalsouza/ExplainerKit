// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Local cubic B-spline displacement lattice; nonlinear curves are bounded polyline approximations. */
export function lattice(first: any, second?: {}, third?: {}): Readonly<{
    columns: any;
    rows: any;
    controls: readonly Readonly<{
        original: Readonly<{
            x: any;
            y: any;
        }>;
        x: any;
        y: any;
    }>[];
    commands: any;
    bounds: Readonly<{
        x: any;
        y: any;
        width: any;
        height: any;
    }>;
    pointCount: number;
    point(column: any, row: any): Readonly<{
        original: Readonly<{
            x: any;
            y: any;
        }>;
        x: any;
        y: any;
    }>;
    sample(context?: {}): any;
}>;
