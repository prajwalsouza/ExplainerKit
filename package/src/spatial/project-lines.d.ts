// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A small immutable line-art model. Dense GPU buffers are a separate backend. */
export function wireframe(spec?: {}): Readonly<{
    vertices: any;
    edges: any;
}>;
export function boxLines(spec?: {}): Readonly<{
    vertices: any;
    edges: any;
}>;
export function sphereLines(spec?: {}): Readonly<{
    vertices: any;
    edges: any;
}>;
/**
 * Clip, project and classify every edge. With normals, an edge is on the back when the averaged
 * normal at its midpoint points away from the camera. Depth is distance along the view direction.
 */
export function projectSegments(geometry: any, camera: any, spec?: {}): any[];
/** CPU line-art projection, frustum clipping and painter depth order; no WebGL. */
export function projectLines(geometry: any, camera: any, spec?: {}): Readonly<{
    width: any;
    height: any;
    children: readonly Readonly<{
        id: `${any}:${any}`;
        type: "line";
        props: Readonly<{
            x1: any;
            y1: any;
            x2: any;
            y2: any;
            fill: "none";
            stroke: any;
            strokeWidth: any;
            opacity: any;
        }>;
        children: readonly never[];
    }>[];
}>;
export function backfaceMode(value?: string): string;
