// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Preserve all text and offsets; Intl.Segmenter is preferred over a bounded fallback. */
export function segmentText(value: any, spec?: {}): Readonly<{
    text: any;
    split: any;
    method: string;
    segments: any;
}>;
/** Pure onset/progress schedule; callers keep one existing story clock. */
export function textStagger(count: any, spec?: {}): Readonly<{
    starts: readonly any[];
    end: any;
    duration: any;
    sample(time: any): readonly number[];
}>;
