// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Capture independent typed arrays. This is a point/line GPU contract, not a scene tree. */
export function capturePointFrame(frame: any, spec?: {}): Readonly<{
    width: any;
    height: any;
    positions: any;
    colors: any;
    indices: any;
    matrix: any;
    color: any;
    clearColor: any;
    pointSize: any;
    pointShape: any;
    blend: any;
    drawPoints: any;
}>;
/** Convert an authored y-down affine drawing into WebGL clip space. */
export function screenProjection(width: any, height: any, spec?: {}): Float32Array<ArrayBuffer>;
/** Analytic projection using the same column-major world-to-clip matrix as the shader. */
export function projectGPUPoint(point: any, m: any, spec?: {}): Readonly<{
    x: null;
    y: null;
    depth: null;
    visible: false;
    w: any;
}> | Readonly<{
    x: number;
    y: number;
    depth: number;
    visible: boolean;
    w: any;
}>;
/** Owned WebGL2 point/line renderer with offscreen preparation and explicit context lifecycle. */
export function createWebGLRenderer(container: any, spec?: {}): Readonly<{
    element: any;
    render: (input: any) => Readonly<{
        width: any;
        height: any;
        points: number;
        lines: number;
        blend: any;
        pointSize: any;
        pointShape: any;
    }> | null;
    dispose: () => void;
    snapshot(): Readonly<{
        width: any;
        height: any;
        positions: any;
        colors: any;
        indices: any;
        matrix: any;
        color: any;
        clearColor: any;
        pointSize: any;
        pointShape: any;
        blend: any;
        drawPoints: any;
    }> | null;
    on(name: any, fn: any): () => any;
    readonly frame: Readonly<{
        width: any;
        height: any;
        points: number;
        lines: number;
        blend: any;
        pointSize: any;
        pointShape: any;
    }> | null;
    readonly capabilities: any;
    readonly lost: boolean;
    readonly disposed: boolean;
    readonly error: any;
}>;
