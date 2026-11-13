// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/**
 * World to screen: anchor*viewport + zoom*R(-rotation)*(world - center).
 * The camera's positive angle rotates the view in the opposite direction.
 * No model geometry is changed. Return values are independent and immutable.
 */
export function cameraMatrix(spec: any, size: any): any;
/** Compose affine transforms; multiplyMatrices(A,B) applies B before A. */
export function multiplyMatrices(left: any, right: any): any;
/** Invert a finite nonsingular affine transform, including its translation. */
export function invertMatrix(value: any): any;
/** Transform a position; a pose object with an extra rotation field is also valid. */
export function transformPoint(value: any, position: any): Readonly<{
    x: any;
    y: any;
}>;
/**
 * Resolve a sampled node's origin and local +x direction in world coordinates.
 * Nested translation, rotation, reflection and nonuniform scaling are composed.
 * Under shear/nonuniform scale, rotation is the angle of the transformed +x axis,
 * not a claim that the whole basis remains orthogonal. Singular targets reject.
 */
export function worldPose(frame: any, nodeId: any): null;
/**
 * Frame a world-space rectangle without cropping any corner after camera rotation.
 * Its center lands on the requested viewport anchor. Noncentral anchors therefore
 * use the smaller available space on either side; padding is uniform screen px.
 * At most MAX_CAMERA_ZOOM is used. A required zoom below MIN_CAMERA_ZOOM rejects.
 */
export function fitRegion(region: any, size: any, spec?: {}): Readonly<{
    x: any;
    y: any;
    zoom: any;
    rotation: any;
    anchorX: any;
    anchorY: any;
}>;
export const MIN_CAMERA_ZOOM: 0.0001;
export const MAX_CAMERA_ZOOM: 10000;
