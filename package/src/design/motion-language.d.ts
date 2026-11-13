// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Design and measure the motion of a shot plan. */
export function planMotion(run: any, { brief, sections, shots, timing }: {
    brief: any;
    sections: any;
    shots: any;
    timing: any;
}): Promise<{
    motion: any;
    measures: any;
    problems: any;
}>;
/** The changes motion can show. */
export const MOTION_VERBS: readonly string[];
/** The principles of animation (Thomas and Johnston, The Illusion of Life). */
export const ANIMATION_PRINCIPLES: readonly string[];
export const MOTION_PRINCIPLES: any;
/** Editorial thresholds for the motion gate. */
export const MOTION_GATE: Readonly<{
    maxMovers: 2;
    maxStatic: 8;
}>;
export const designMotion: Readonly<{
    name: any;
    kind: any;
    purpose: any;
    output: any;
    compute: any;
}> | Readonly<{
    name: any;
    kind: any;
    purpose: any;
    role: any;
    method: readonly any[];
    examples: readonly any[];
    rules: readonly any[];
    output: any;
    search: boolean;
    effort: any;
}>;
export const motionMeasures: Readonly<{
    name: any;
    kind: any;
    purpose: any;
    output: any;
    compute: any;
}> | Readonly<{
    name: any;
    kind: any;
    purpose: any;
    role: any;
    method: readonly any[];
    examples: readonly any[];
    rules: readonly any[];
    output: any;
    search: boolean;
    effort: any;
}>;
