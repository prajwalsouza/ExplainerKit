// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
export function matrix3D(value: any): any[];
/** Column-major multiplication. A*B applies B before A. */
export function multiply3D(left: any, right: any): any;
/** Pivoted Gauss–Jordan inverse; rejects a singular transform explicitly. */
export function inverse3D(value: any): any;
export function point3D(input: any, label?: string): {
    x: any;
    y: any;
    z: any;
};
/** Apply a full projective matrix, including homogeneous division. */
export function transform3D(matrix: any, position: any): Readonly<{
    x: any;
    y: any;
    z: any;
}>;
/** T * Rx * Ry * Rz * S, matching Three's intrinsic XYZ Euler convention. */
export function compose3D(spec?: {}): any;
export function direction3D(value: any): Readonly<{
    x: number;
    y: number;
    z: number;
}>;
export function lookAt3D(eye: any, target: any, up?: {
    x: number;
    y: number;
    z: number;
}): any;
/** Resolve a raw scene node's composed model transform without a renderer. */
export function worldMatrix3D(frame: any, id: any): null;
export const identity3D: readonly number[];
