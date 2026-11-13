// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function spatialViewport(value?: {
    width: number;
    height: number;
}): Readonly<{
    width: any;
    height: any;
}>;
/** Right-handed camera looks down local -z; fov is vertical radians. */
export function perspectiveCamera(spec: {} | undefined, viewport: any): Readonly<{
    type: any;
    viewport: any;
    near: any;
    far: any;
    matrixWorld: any;
    viewMatrix: any;
    projectionMatrix: any;
    viewProjectionMatrix: any;
    inverseViewProjectionMatrix: any;
}>;
/** Orthographic bounds are authored world units; depth does not change size. */
export function orthographicCamera(spec: {} | undefined, viewport: any): Readonly<{
    type: any;
    viewport: any;
    near: any;
    far: any;
    matrixWorld: any;
    viewMatrix: any;
    projectionMatrix: any;
    viewProjectionMatrix: any;
    inverseViewProjectionMatrix: any;
}>;
export function requireCamera(camera: any): any;
/** Screen origin top-left; depth is WebGL normalized depth [0,1] in-frustum. */
export function projectPoint(camera: any, point: any): Readonly<{
    x: number;
    y: number;
    depth: number;
    cameraDepth: number;
    visible: boolean;
    ndc: Readonly<{
        x: any;
        y: any;
        z: any;
    }>;
}>;
export function unprojectPoint(camera: any, screen: any): Readonly<{
    x: any;
    y: any;
    z: any;
}>;
export function screenRay(camera: any, screen: any): Readonly<{
    origin: Readonly<{
        x: any;
        y: any;
        z: any;
    }>;
    direction: Readonly<{
        x: number;
        y: number;
        z: number;
    }>;
    near: any;
    far: any;
}>;
/** Orbit around a world target; angles are deltas in radians, radius stays fixed. */
export function orbitCamera(camera: any, spec?: {}): any;
/** Positive distance moves along the camera's local forward direction (-z). */
export function dollyCamera(camera: any, distance: any): any;
/** Lens/frustum magnification, distinct from moving the camera. */
export function zoomCamera(camera: any, factor: any): any;
/** Batch xyz triples into packed screen xy, normalized depth and visibility buffers.
 * @param {ReturnType<typeof perspectiveCamera>|ReturnType<typeof orthographicCamera>} camera
 * @param {Float32Array|Float64Array} coordinates
 */
export function projectPoints(camera: ReturnType<typeof perspectiveCamera> | ReturnType<typeof orthographicCamera>, coordinates: Float32Array | Float64Array): Readonly<{
    count: number;
    positions: Float64Array<ArrayBuffer>;
    depths: Float64Array<ArrayBuffer>;
    cameraDepths: Float64Array<ArrayBuffer>;
    visible: Uint8Array<ArrayBuffer>;
}>;
