// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** CSS cubic-bezier: invert x, then evaluate y. End tangents extrapolate outside [0,1]. */
export function cubicBezier(x1: any, y1: any, x2: any, y2: any): (progress: any) => any;
/** Plan all segments before the caller mutates a channel. Each key eases its outgoing segment. */
export function prepareKeyframes(tracks: any, property: any, keys: any, baseline: any): readonly any[];
export function makeTrack(spec: any): Readonly<{
    property: any;
    from: any;
    to: any;
    at: any;
    duration: any;
    end: any;
    ease: any;
}>;
/** Prepare a track without changing its channel. Helpers infer starts only from authored history. */
export function prepareTrack(tracks: any, spec: any, baseline: any, { continuation }?: {
    continuation?: boolean | undefined;
}): Readonly<{
    property: any;
    from: any;
    to: any;
    at: any;
    duration: any;
    end: any;
    ease: any;
}>;
export function trackValue(tracks: any, time: any, baseline: any): any;
export const easings: Readonly<{
    linear: (t: any) => any;
    smooth: (t: any) => number;
    easeOut: (t: any) => number;
    easeInOut: (t: any) => number;
    launch: (progress: any) => any;
    titleOpen: (progress: any) => any;
    anticipateOut: (progress: any) => any;
    linearStop: (t: any) => number;
    snapIn: typeof snapCurve;
}>;
/** Original snap convention shared with keyed poses; empirical Clip3 fit remains a separate gate. */
declare function snapCurve(t: any): number;
export {};
