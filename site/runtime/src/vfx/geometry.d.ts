// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function point(value: any): Readonly<{
    x: any;
    y: any;
}>;
export function orientation(quad: any): 0 | 1 | -1;
export function corners(value: any): any;
export function rect(value: any, name?: string): {
    x: any;
    y: any;
    width: any;
    height: any;
};
export function quadFor(r: any): {
    x: any;
    y: any;
}[];
export function apply(matrix: any, x: any, y: any): {
    x: number;
    y: number;
};
export function fit(matches: any, motion: any, scale?: number): any[] | null;
/** Map a rectangle's local coordinates to its four image corners. */
export function surfaceTransform(surface: any, width?: number, height?: number): readonly number[];
export function projectSurface(surface: any, u: any, v: any): Readonly<{
    x: number;
    y: number;
}>;
export function matteOutline(value: any): any;
/** Keep the image outside the supplied foreground outline. */
export function foregroundHoldout(outline: any, width: any, height: any): Readonly<{
    type: "path";
    units: "user";
    fillRule: "evenodd";
    commands: readonly any[];
}>;
