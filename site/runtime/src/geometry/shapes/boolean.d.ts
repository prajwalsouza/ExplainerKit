// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Flatten M/L/Q/C/Z commands into closed loops of points. Open subpaths are closed implicitly. */
export function pathLoops(commands: any, spec?: {}): any[];
/**
 * Boolean of two filled outlines with any concavity and holes: 'union', 'intersect' or 'subtract' (a minus b).
 * Operands are path commands (curves flattened within tolerance) or loop arrays from pathLoops. Fill uses
 * even-odd nesting. The result keeps outer loops counter-clockwise and holes clockwise, so it draws with either
 * fill rule and strokes only real boundaries.
 */
export function booleanPath(operation: any, a: any, b: any, spec?: {}): Readonly<{
    commands: readonly (readonly string[])[];
    loops: readonly (readonly Readonly<{
        x: any;
        y: any;
    }>[])[];
    area: number;
}>;
export function unionPaths(a: any, b: any, spec: any): Readonly<{
    commands: readonly (readonly string[])[];
    loops: readonly (readonly Readonly<{
        x: any;
        y: any;
    }>[])[];
    area: number;
}>;
export function intersectPaths(a: any, b: any, spec: any): Readonly<{
    commands: readonly (readonly string[])[];
    loops: readonly (readonly Readonly<{
        x: any;
        y: any;
    }>[])[];
    area: number;
}>;
export function subtractPaths(a: any, b: any, spec: any): Readonly<{
    commands: readonly (readonly string[])[];
    loops: readonly (readonly Readonly<{
        x: any;
        y: any;
    }>[])[];
    area: number;
}>;
