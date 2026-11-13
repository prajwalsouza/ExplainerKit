// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** A normalized right-handed quaternion. Invalid or zero orientations reject. */
export function quaternion(spec?: {}): Readonly<{
    x: number;
    y: number;
    z: number;
    w: number;
}>;
export function quaternionFromEuler(spec?: {}): Readonly<{
    x: number;
    y: number;
    z: number;
    w: number;
}>;
export function quaternionFromAxisAngle(axis: any, angle: any): Readonly<{
    x: number;
    y: number;
    z: number;
    w: number;
}>;
export function multiplyQuaternion(left: any, right: any): Readonly<{
    x: number;
    y: number;
    z: number;
    w: number;
}>;
/** Shortest-arc spherical interpolation; t is deterministic, not frame history. */
export function slerpQuaternion(from: any, to: any, t: any): Readonly<{
    x: number;
    y: number;
    z: number;
    w: number;
}>;
export function quaternionMatrix(input: any): readonly number[];
export function rotateVector3D(orientation: any, vector: any): Readonly<{
    x: any;
    y: any;
    z: any;
}>;
