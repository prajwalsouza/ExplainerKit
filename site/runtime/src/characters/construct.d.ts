// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Position, unit tangent and unit normal at fraction s (0–1, by length) along a polyline. */
export function frameAlong(points: any, s: any): any;
/**
 * A thickness profile along a body: rises from `nose` to `max` and narrows to `end` (never zero), the way a
 * fish narrows to its tail stalk or a limb to its wrist. peak is where the body is thickest (0–1).
 * @param {{max:number,nose?:number,end?:number,peak?:number}} spec
 */
export function taper({ max, nose, end, peak }?: {
    max: number;
    nose?: number;
    end?: number;
    peak?: number;
}): (s: any) => number;
/**
 * Closed outline around a spine (points from head to tail) with half-thickness given by width(s).
 * Ends get explicit round or flat caps, so the outline cannot overshoot into a needle or a loop.
 */
export function tube(spine: any, width: any, { startCap, endCap, samples }?: {
    startCap?: string | undefined;
    endCap?: string | undefined;
    samples?: number | undefined;
}): any;
/**
 * Place a shape drawn in its own frame (root at the origin, growing along +x) onto a parent frame, sunk back
 * into the parent by `overlap` units so the seam hides inside the parent. angle adds a hinge rotation.
 */
export function appendage(shape: any, frame: any, { overlap, angle, scale }?: {
    overlap?: number | undefined;
    angle?: number | undefined;
    scale?: number | undefined;
}): any;
/** A frame on the surface of a tube: the spine frame at s moved out along the normal by side × width(s). */
export function surfaceFrame(spine: any, width: any, s: any, side?: number): any;
/**
 * Common appendage shapes in their own frame (root at origin, extending along +x), ready for appendage():
 * forked and rounded tail fins, pointed fins, leaves/ears and petals. root is the half-width at the base.
 */
export const shapes: Readonly<{
    forkedFin: ({ length, spread, root, fork, round }?: {
        length?: number | undefined;
        spread?: number | undefined;
        root?: number | undefined;
        fork?: number | undefined;
        round?: number | undefined;
    }) => any;
    roundFin: ({ length, spread, root }?: {
        length?: number | undefined;
        spread?: number | undefined;
        root?: number | undefined;
    }) => any;
    pointedFin: ({ length, spread, root, sweep }?: {
        length?: number | undefined;
        spread?: number | undefined;
        root?: number | undefined;
        sweep?: number | undefined;
    }) => any;
    leaf: ({ length, width }?: {
        length?: number | undefined;
        width?: number | undefined;
    }) => any;
}>;
