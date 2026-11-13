// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * Capture a point cloud: xy positions, optional per-point radii and optional RGBA colors in [0,1].
 * The result owns copies of every buffer, so later edits to the caller's arrays never leak into a frame.
 */
export function cloudPoints(value: any): any;
export function pointShape(value: any): any;
export function pointBlend(value: any): any;
/** A solid paint as straight-alpha [r,g,b,a] in [0,1]. Gradients are not point colors. */
export function rgbaOf(value: any): number[];
/** Local bounding box of the drawn points, including radii. Empty clouds have no bounds. */
export function cloudBounds(cloud: any, fallbackRadius: any): {
    x: number;
    y: number;
    width: number;
    height: number;
} | null;
/** Recolor every point through a color function on straight-alpha channels. */
export function mapCloudColors(cloud: any, map: any): any;
/** Validate a renderer-side cloud without copying again when it is already captured. */
export function inspectCloud(value: any): any;
export function cloudRadius(value: any): any;
/** One drawable node can hold this many points. Renderers may set narrower limits. */
export const MAX_CLOUD_POINTS: 200000;
export const POINT_SHAPES: readonly string[];
export const EMPTY_CLOUD: Readonly<{
    count: 0;
    positions: Float32Array<ArrayBuffer>;
    radii: null;
    colors: null;
}>;
