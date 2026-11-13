// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Capture trusted callbacks separately from bounded, accessor-free cue descriptors. */
export function captureCues(value?: any[]): readonly Readonly<{
    id: any;
    at: any;
    reverse: any;
    enter: any;
    leave: any;
    index: number;
}>[];
/** Resolve locations without touching state, so failed timeline replacements stay transactional. */
export function locateCues(cues: any, timeline: any): any;
/** State only: the owning story supplies position/pace and owns all scheduling and disposal. */
export function cueController(cues: any, timeline: any, current: any): Readonly<{
    validate(next: any): any;
    remap(next: any): void;
    advance(sampled: any, pace: any, reduced: any, position?: any): void;
    dispose(): void;
}>;
