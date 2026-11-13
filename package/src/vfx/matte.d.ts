// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Expand or contract a coverage matte, then soften its edge. */
export function adjustMatte(alpha: any, width: any, height: any, spec?: {}): Uint8ClampedArray<any>;
/** Composite straight sRGB footage and an insert using foreground coverage and an optional clean plate. */
export function compositeMatte(input: any): Uint8ClampedArray<ArrayBuffer>;
/** Keep the visible part of an RGBA insert using registered camera-space depth. */
export function applyDepthHoldout(input: any): Uint8ClampedArray<any>;
