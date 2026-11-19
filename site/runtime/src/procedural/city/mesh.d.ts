// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function rgb(color: any): any;
/**
 * A growable mesh. `extra` is how many extra numbers each vertex carries (0, 4, 8 or 12); the
 * finished mesh returns them as `extra` with that stride. A frame maps local coordinates to the
 * world, so parts can be modelled around an origin and placed along a wall or at a position.
 */
export function meshBuilder(extra: number | undefined, budget: {
    vertices: number;
} | undefined, elevation: any): {
    readonly vertexCount: number;
    readonly triangleCount: number;
    /** Place following geometry at `origin` with local x along `ux` and local y along `uy`. */
    frame(ox: any, oy: any, oz: any, ux: any, uy: any, uz: any): /*elided*/ any;
    /** Place following geometry at a point, turned by `turn` radians about the vertical axis. */
    at(x: any, y: any, z: any, turn?: number, scale?: number): /*elided*/ any;
    reset(): /*elided*/ any;
    /** Set the extra numbers written with following vertices. */
    extra(...values: any[]): /*elided*/ any;
    setExtra(i: any, v: any): /*elided*/ any;
    /** One vertex from local position and local normal. Returns its index. */
    vertex(x: any, y: any, z: any, nx: any, ny: any, nz: any, c: any): number;
    tri(a: any, b: any, c: any): void;
    /** A flat polygon from local points given counter-clockwise as seen from its front. */
    poly(points: any, c: any, normal: any): number;
    quad(a: any, b: any, c2: any, d: any, c: any, normal: any): number;
    /** An axis-aligned box in the local frame. `skip` lists faces to leave out: x0 x1 y0 y1 z0 z1. */
    box(x0: any, y0: any, z0: any, x1: any, y1: any, z1: any, c: any, skip?: string): /*elided*/ any;
    /**
     * A round or many-sided column along local y from (r0 at y0) to (r1 at y1), with smooth
     * side normals. `caps` is '', 'top', 'bottom' or 'both'.
     */
    column(cx: any, cz: any, y0: any, y1: any, r0: any, r1: any, c: any, sides?: number, caps?: string, turn?: number): /*elided*/ any;
    /** A tube of radius r (number or one per point) along local points, for arms, rails and wires. */
    tube(points: any, r: any, c: any, sides?: number, caps?: boolean): /*elided*/ any;
    /**
     * A rounded lump: a subdivided icosahedron scaled to (rx, ry, rz) and pushed in and out by
     * `bump(x, y, z)` (a value near 1). `colour(nx, ny, nz)` may vary the colour over it.
     */
    blob(cx: any, cy: any, cz: any, rx: any, ry: any, rz: any, c: any, detail?: number, bump?: null, colour?: null): /*elided*/ any;
    /** A surface of revolution about local y from a profile of [radius, y] pairs, bottom to top. */
    lathe(cx: any, cz: any, profile: any, c: any, sides?: number): /*elided*/ any;
    /** Append a finished mesh through the current frame, optionally tinted. */
    append(mesh: any, tint?: null): /*elided*/ any;
    finish(): {
        positions: Float32Array<ArrayBuffer>;
        normals: Float32Array<ArrayBuffer>;
        colors: Float32Array<ArrayBuffer>;
        extra: Float32Array<ArrayBuffer>;
        extraStride: number;
        indices: Uint32Array<ArrayBuffer>;
        vertexCount: number;
        triangleCount: number;
    };
};
/** Signed area of a ring of {x, y} points: positive when counter-clockwise. */
export function ringArea(ring: any): number;
export function pointInRing(x: any, y: any, ring: any): boolean;
/** Distance from a point to the nearest edge of a ring. */
export function ringDistance(x: any, y: any, ring: any): number;
export function segmentDistance(x: any, y: any, a: any, b: any): number;
/** Drop points that lie on a straight run, so a wall is one face rather than many slivers. */
export function simplifyRing(ring: any, tolerance?: number): any;
/**
 * Move a ring outward by `d` metres (inward when negative), joining edges at mitres. Returns
 * null when the result folds over itself, which the caller treats as "no offset possible".
 */
export function offsetRing(ring: any, d: any, limit?: number): {
    x: any;
    y: any;
}[] | null;
/** The smallest rectangle around a ring: centre, unit axes (long and short) and half sizes. */
export function orientedBox(ring: any): {
    cx: number;
    cy: number;
    lx: number;
    ly: number;
    sx: number;
    sy: number;
    hl: number;
    hs: number;
};
/**
 * Triangulate a polygon with holes by ear clipping. `ring` is counter-clockwise, holes are
 * clockwise. Returns {points, triangles}: the points used (the ring, then the holes) and index
 * triples that are counter-clockwise. Work is bounded by the square of the vertex count.
 */
export function triangulate(ring: any, holes?: any[]): {
    points: any[];
    triangles: any[];
};
/**
 * Keep the part of a convex polygon where f(p) <= 0, for a linear function given by its values
 * at each point. Points are arrays; `values[i]` belongs to `poly[i]`. Returns the kept points.
 */
export function clipConvex(poly: any, values: any): any[];
export const MAX_VERTICES: 6000000;
export function shade(c: any, k: any): number[];
export function blend(a: any, b: any, t: any): any[];
export function dot3(a: any, b: any): number;
export function cross3(a: any, b: any): number[];
export function norm3(a: any): number[];
