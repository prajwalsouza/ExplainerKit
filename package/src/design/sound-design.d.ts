// Generated declaration inference with reviewed overrides; see docs/types.md for scope.
/** Plan and measure sound, or skip with a reason when the medium has neither music nor effects. */
export function planSound(run: any, { brief, shots, timing, structure, motion, medium }: {
    brief: any;
    shots: any;
    timing: any;
    structure: any;
    motion?: null | undefined;
    medium: any;
}): Promise<{
    skipped: boolean;
    reason: string;
    problems: never[];
    sound?: undefined;
    measures?: undefined;
} | {
    skipped: boolean;
    sound: any;
    measures: any;
    problems: any;
    reason?: undefined;
}>;
export const SOUND_PRINCIPLES: any;
export const designSound: Readonly<{
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
export const soundMeasures: Readonly<{
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
