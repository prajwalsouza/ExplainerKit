// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Capture an independent, immutable frame. Does not retain bindings or drivers. */
export function captureState(frame: any): Readonly<{
    motionBlur?: Readonly<{
        frames: any;
        weights: any;
    }> | undefined;
    light?: Readonly<{
        angle: any;
        color: any;
        ambient: any;
    }> | undefined;
    width: any;
    height: any;
    children: any;
}>;
/**
 * Prepare a deterministic, linear state transition. Each endpoint is captured
 * once. Identity, type, parent and path topology must match; split/merge,
 * entering/exiting, reparenting and automatic path matching are unsupported.
 *
 * Numeric properties interpolate directly (rotation follows signed radians).
 * Text, colors and categorical descriptors switch at the end by default;
 * discrete:'start' switches immediately after progress zero. Explicit paths:morph
 * and colors:srgb/linearRGB opt into prepared contour and paint interpolation.
 * Sibling order switches only at progress one, independently of discrete policy.
 */
export function createTransition(from: any, to: any, spec?: {}): Readonly<{
    sample(progress: any): Readonly<{
        light?: Readonly<{
            angle: any;
            color: any;
            ambient: any;
        }> | undefined;
        width: any;
        height: any;
        children: any;
    }>;
}>;
/** One-shot convenience; reuse createTransition for repeated frame sampling. */
export function interpolateStates(from: any, to: any, progress: any, spec: any): Readonly<{
    light?: Readonly<{
        angle: any;
        color: any;
        ambient: any;
    }> | undefined;
    width: any;
    height: any;
    children: any;
}>;
